import * as React from 'react';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import { Notifications } from '@twilio/flex-ui';

import { Actions as RecordingStatusActions, } from '../../states/RecordingState';
import RecordingUtil from '../../utils/RecordingUtil';
import { getCustomerLiveParticipant, getMyLiveParticipant } from '../../utils';

const RESUME_RECORDING = 'ResumeRecording';
const RESUME_FAILED = 'ResumeFailed';

class ConferenceMonitor extends React.Component {
  state = {
    liveParticipantCount: 0
  }

  componentDidUpdate() {
    const { recordingSid, recordingStatus, task } = this.props;
    const conference = task?.conference || {};
    const participants = conference?.participants || [];
    const myParticipant = getMyLiveParticipant(participants);
    const callSid = myParticipant?.callSid;
    const {
      liveParticipantCount
    } = conference;

    console.debug('ConferenceMonitor, componentDidUpdate:',
      { liveParticipantCount, stateLiveParticipantCount: this.state.liveParticipantCount });

    if (liveParticipantCount > 2 && this.state.liveParticipantCount <= 2) {
      this.handleMoreThanTwoParticipants(callSid, recordingSid, recordingStatus);
    } else if (liveParticipantCount <= 2 && this.state.liveParticipantCount > 2) {
      this.handleOnlyTwoParticipants();
    }

    if (liveParticipantCount !== this.state.liveParticipantCount) {
      this.setState({ liveParticipantCount });
    }
  }

  //TODO: Evaluate for removal
  hasUnknownParticipant = (participants = []) => {
    return participants.some(p => p.participantType === 'unknown');
  }

  //TODO: Evaluate for removal
  shouldUpdateParticipants = (participants, liveWorkerCount) => {
    console.debug(
      'dialpad-addon, ConferenceMonitor, shouldUpdateParticipants:',
      liveWorkerCount <= 1 && this.hasUnknownParticipant(participants)
    );
    return liveWorkerCount <= 1 && this.hasUnknownParticipant(participants);
  }

  handleMoreThanTwoParticipants = async (callSid, recordingSid, recordingStatus) => {
    console.debug('ConferenceMonitor, handleMoreThanTwoParticipants:', { recordingSid, recordingStatus});

    this.props.disableRecordingPause();

    if (recordingStatus == 'paused') {
      console.log('More than two conference participants and recording paused.');
      try {
        const rec = await RecordingUtil.resumeRecording(callSid, recordingSid);
        console.log("Resume Recording");
        console.log('Recording Sid Returned: ', rec.sid, 'status:', rec.status);
        //Update app state in Redux store
        this.props.setRecordingStatus(rec.status);
        Notifications.showNotification(RESUME_RECORDING);
      } catch (err) {
        console.log('Failed to resume recording');
        Notifications.showNotification(RESUME_FAILED);
      }
    }
  }

  //TODO: Evaluate for removal
  handleOnlyTwoParticipants = () => {
    console.log('ConferenceMonitor, handleOnlyTwoParticipants');
    this.props.enableRecordingPause();
  }

  render() {
    // This is a Renderless Component, only used for monitoring and taking action on conferences
    return null;
  }
}

const mapStateToProps = state => {
  return {
    recordingStatus: state['pause-recording']?.recording?.status,
    recordingSid: state['pause-recording']?.recording?.sid,
    pauseDisabled: state['pause-recording']?.recording?.pauseDisabled
  };
};

const mapDispatchToProps = (dispatch) => ({
  setRecordingStatus: bindActionCreators(RecordingStatusActions.setRecordingStatus, dispatch),
  disableRecordingPause: bindActionCreators(RecordingStatusActions.disableRecordingPause, dispatch),
  enableRecordingPause: bindActionCreators(RecordingStatusActions.enableRecordingPause, dispatch)
});

export default connect(mapStateToProps, mapDispatchToProps)(ConferenceMonitor);
