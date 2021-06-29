import { Actions, Manager, TaskHelper } from '@twilio/flex-ui';
import { ParticipantType, ReservationEvents } from '../enums';
import { Actions as RecordingStatusActions, } from '../states/RecordingState';
import RecordingUtil from '../utils/RecordingUtil';
import { getCustomerLiveParticipant, getMyLiveParticipant } from '../utils';


const manager = Manager.getInstance();
const reservationListeners = new Map();


//Moved startCallRecording to RecordingUtil

const addCallDataToTask = async (task, callSid, recording) => {
  const { attributes, conference } = task;

  const newAttributes = { ...attributes };
  let shouldUpdateTaskAttributes = false;

  if (TaskHelper.isOutboundCallTask(task)
    && (!attributes.conference || !attributes.call_sid)) {
    shouldUpdateTaskAttributes = true;
    // Last Reviewed: 2021/02/01 (YYYY/MM/DD)
    // Outbound calls initiated from Flex (via StartOutboundCall Action)
    // do not include call_sid and conference metadata in task attributes
    newAttributes.conference = { sid: conference.conferenceSid };
    
    // callSid will be undefined if the outbound call was ended before
    // the called party answered
    newAttributes.call_sid = callSid;
  }

  if (recording) {
    shouldUpdateTaskAttributes = true;
    const reservationAttributes = attributes.reservation_attributes || {};

    const state = manager.store.getState();
    const flexState = state && state.flex;
    const workerState = flexState && flexState.worker;
    const accountSid = workerState && workerState.source.accountSid;

    const { sid: recordingSid } = recording;
    const twilioApiBase = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}`;
    const recordingUrl = `${twilioApiBase}/Recordings/${recordingSid}`;

    const { dateUpdated, sid: reservationSid } = task;

    // Using one second before task updated time to workaround a Flex Insights
    // bug if the recording start time is after the reservation.accepted event
    const recordingStartTime = new Date(dateUpdated).valueOf() - 1000;

    const newReservationAttributes = {};
    newReservationAttributes[reservationSid] = {
      media: [{
        url: recordingUrl,
        type: 'VoiceRecording',
        channels: [ 'customer', 'others' ],
        start_time: recordingStartTime
      }]
    };

    newAttributes.reservation_attributes = {
      ...reservationAttributes,
      ...newReservationAttributes
    };
  }

  if (shouldUpdateTaskAttributes) {
    await task.setAttributes(newAttributes);
  }
}

const isTaskActive = (task) => {
  const { sid: reservationSid, taskStatus } = task;
  if (taskStatus === 'canceled') {
    return false;
  } else {
    return manager.workerClient.reservations.has(reservationSid);
  }
}

const waitForConferenceParticipants = (task) => new Promise(resolve => {
  const waitTimeMs = 100;
  // For outbound calls, the customer participant doesn't join the conference 
  // until the called party answers. Need to allow enough time for that to happen.
  const maxWaitTimeMs = 60000;
  let waitForConferenceInterval = setInterval(async () => {
    const { conference } = task;

    if (!isTaskActive(task)) {
      console.debug('Call canceled, clearing waitForConferenceInterval');
      waitForConferenceInterval = clearInterval(waitForConferenceInterval);
      return;
    }
    if (conference === undefined) {
      return;
    }
    const { participants } = conference;
    if (Array.isArray(participants) && participants.length < 2) {
      return;
    }
    const myParticipant = getMyLiveParticipant(participants);
    const customer = getCustomerLiveParticipant(participants);

    if (!myParticipant || !customer) {
      return;
    }

    console.debug('Worker and customer participants joined conference');
    waitForConferenceInterval = clearInterval(waitForConferenceInterval);

    resolve(participants);
  }, waitTimeMs);

  setTimeout(() => {
    if (waitForConferenceInterval) {
      console.debug(`Customer participant didn't show up within ${maxWaitTimeMs / 1000} seconds`);
      clearInterval(waitForConferenceInterval)

      resolve([])
    }
  }, maxWaitTimeMs);
});

const addMissingCallDataIfNeeded = async (task) => {
  const { attributes } = task;
  const { conference } = attributes;

  if (TaskHelper.isOutboundCallTask(task) && !conference) {
    // Only worried about outbound calls since inbound calls automatically
    // have the desired call and conference metadata
    await addCallDataToTask(task);
  }
}

Actions.addListener('beforeCompleteTask', async (payload) => {
  // Listening for this event as a last resort check to ensure call
  // and conference metadata are captured on the task
  addMissingCallDataIfNeeded(payload.task);
});

Actions.addListener('beforeHangupCall', async (payload) => {
  // Listening for this event to at least capture the conference SID
  // if the outbound call is canceled before the called party answers
  addMissingCallDataIfNeeded(payload.task)
});

const handleAcceptedCall = async (task) => {
  // We want to wait for all participants (customer and worker) to join the
  // conference before we start the recording
  console.debug('Waiting for customer and worker to join the conference');
  const participants = await waitForConferenceParticipants(task);

  const myParticipant = getMyLiveParticipant(participants);
  const customer = getCustomerLiveParticipant(participants);

  if (!customer) {
    console.warn('No customer participant. Not starting the call recording');
    return;
  }

  const { callSid: myCallSid } = myParticipant;
  const { callSid: customerCallSid } = customer;

  const recording = await RecordingUtil.startCallRecording(myCallSid);
  await addCallDataToTask(task, customerCallSid, recording);
  //Update recording status in the Redux store app state
  console.log('Recording status:', recording.status);
  manager.store.dispatch(RecordingStatusActions.setRecordingStatus((recording.status)));
};

const handleReservationAccepted = async (reservation) => {
  const task = TaskHelper.getTaskByTaskSid(reservation.sid);

  if (TaskHelper.isCallTask(task)) {
    await handleAcceptedCall(task);
  }
}

const handleWrapupCall = (task) => {
  manager.store.dispatch(RecordingStatusActions.resetRecordingState());
}

const handleReservationWrapup = (reservation) => {
  const task = TaskHelper.getTaskByTaskSid(reservation.sid);

  if (TaskHelper.isCallTask(task)) {
    handleWrapupCall(task);
  }
}

const handleReservationUpdated = (event, reservation) => {
  console.debug('Event, reservation updated', event, reservation);
  switch (event) {
    case ReservationEvents.accepted: {
      handleReservationAccepted(reservation);
      break; 
    }
    case ReservationEvents.wrapup:
      handleReservationWrapup(reservation);
      break;
    case ReservationEvents.completed:
    case ReservationEvents.rejected:
    case ReservationEvents.timeout:
    case ReservationEvents.canceled:
    case ReservationEvents.rescinded: {
      stopReservationListeners(reservation);
      break;
    }
    default:
      break;
  }
};

const stopReservationListeners = (reservation) => {
  const listeners = reservationListeners.get(reservation);
  if (listeners) {
    listeners.forEach(listener => {
      reservation.removeListener(listener.event, listener.callback);
    });
    reservationListeners.delete(reservation);
  }
};

const initReservationListeners = (reservation) => {
  const trueReservation = reservation.addListener ? reservation : reservation.source;
  stopReservationListeners(trueReservation);
  const listeners = [];
  Object.values(ReservationEvents).forEach(event => {
    const callback = () => handleReservationUpdated(event, trueReservation);
    trueReservation.addListener(event, callback);
    listeners.push({ event, callback });
  });
  reservationListeners.set(trueReservation, listeners);
};

const handleNewReservation = (reservation) => {
  console.debug('new reservation', reservation);
  initReservationListeners(reservation);
};

const handleReservationCreated = (reservation) => {
  handleNewReservation(reservation);
};

manager.workerClient.on('reservationCreated', reservation => {
  handleReservationCreated(reservation);
});
