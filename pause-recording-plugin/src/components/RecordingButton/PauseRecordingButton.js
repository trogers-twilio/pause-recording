import React from 'react';
import { Notifications, TaskHelper, IconButton, withTaskContext } from '@twilio/flex-ui';
import { connect } from "react-redux";
import { bindActionCreators } from 'redux';
import { Actions as RecordingStatusActions, } from '../../states/RecordingState';
import RecordingUtil from '../../utils/RecordingUtil';
import { getMyLiveParticipant } from '../../utils';

let recSid; //store recording Sid
const RECORDING_PAUSED = 'RecordingPaused';
const RESUME_RECORDING = 'ResumeRecording';
const PAUSE_FAILED = 'PauseFailed';
const RESUME_FAILED = 'ResumeFailed';

const pauseState = {
  icon: 'EyeBold',
  color: 'red',
  label: 'Resume'
};

const recState = {
  icon: 'Eye',
  color: 'green',
  label: 'Pause'
};
class PauseRecordingButton extends React.Component {
  constructor(props) {
    super(props);
    this.state = recState;
  }

  handleClick = async () => {
    const { task } = this.props;
    const { conference } = task;
    const participants = conference.participants || [];
    const myParticipant = getMyLiveParticipant(participants);

    let callSid = myParticipant?.callSid;

    if (this.props.status == 'paused') {
      try {
        const rec = await RecordingUtil.resumeRecording(callSid, recSid);
        this.setState(recState);
        console.log("Resume Recording");
        console.log('Recording Sid Returned: ', rec.sid, 'status:', rec.status);
        //Update app state in Redux store
        this.props.setRecordingStatus(rec.status);
        Notifications.showNotification(RESUME_RECORDING);
      } catch (err) {
        console.log('Failed to resume recording');
        Notifications.showNotification(RESUME_FAILED);

      }
    } else {
      try {
        const rec = await RecordingUtil.pauseRecording(callSid);
        this.setState(pauseState);
        console.log("Pause Recording");
        recSid = rec.sid;
        console.log('Recording Sid Returned: ', recSid, 'status:', rec.status);
        //Update app state in Redux store
        this.props.setRecordingStatus(rec.status);
        this.props.setRecordingSid(rec.sid);
        Notifications.showNotification(RECORDING_PAUSED);
      } catch (err) {
        console.log('Failed to pause recording');
        Notifications.showNotification(PAUSE_FAILED);
      }
    }
  }


  render() {
    const isLiveCall = TaskHelper.isLiveCall(this.props.task);
    const buttonStyle = this.props.status === 'paused'
      ? pauseState : recState;

    return (
      <IconButton
        icon={buttonStyle.icon}
        key="pause_button"
        style={{ "color": buttonStyle.color }}
        disabled={!isLiveCall || this.props.pauseDisabled}
        title={buttonStyle.label}
        onClick={() => this.handleClick()}
      />
    );
  }
}
//recording object contains status
const mapStateToProps = state => {
  return {
    status: state['pause-recording']?.recording?.status,
    pauseDisabled: state['pause-recording']?.recording?.pauseDisabled
  };
}
const mapDispatchToProps = (dispatch) => ({
  setRecordingStatus: bindActionCreators(RecordingStatusActions.setRecordingStatus, dispatch),
  setRecordingSid: bindActionCreators(RecordingStatusActions.setRecordingSid, dispatch),
});

export default connect(mapStateToProps, mapDispatchToProps)(withTaskContext(PauseRecordingButton));
