const ACTION_SET_REC_STATUS = 'SET_REC_STATUS';
const ACTION_SET_REC_SID = 'SET_REC_SID';
const ACTION_DISABLE_REC_PAUSE = 'DISABLE_REC_PAUSE';
const ACTION_ENABLE_REC_PAUSE = 'ENABLE_REC_PAUSE';
const ACTION_RESET_REC_STATE = 'RESET_REC_STATE';


const initialState = {
  pauseDisabled: false
};

export class Actions {
  static setRecordingStatus = (status) => ({ type: ACTION_SET_REC_STATUS, status });
  static setRecordingSid = (sid) => ({ type: ACTION_SET_REC_SID, sid });
  static disableRecordingPause = () => ({ type: ACTION_DISABLE_REC_PAUSE });
  static enableRecordingPause = () => ({ type: ACTION_ENABLE_REC_PAUSE });
  static resetRecordingState = () => ({ type: ACTION_RESET_REC_STATE });
};

export function reduce(state = initialState, action) {
  switch (action.type) {
    case ACTION_SET_REC_STATUS: {
      return {
        ...state,
        status: action.status
      };
    }
    case ACTION_SET_REC_SID: {
      return {
        ...state,
        sid: action.sid
      };
    }
    case ACTION_DISABLE_REC_PAUSE: {
      return {
        ...state,
        pauseDisabled: true
      }
    }
    case ACTION_ENABLE_REC_PAUSE: {
      return {
        ...state,
        pauseDisabled: false
      }
    }
    case ACTION_RESET_REC_STATE: {
      return initialState;
    }
    default:
      return state;
  }
};
