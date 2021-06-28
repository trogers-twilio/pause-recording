const ACTION_SET_REC_STATUS = 'SET_REC_STATUS';
const ACTION_SET_REC_SID = 'SET_REC_SID';

const initialState = {};

export class Actions {
  static setRecordingStatus = (status) => ({ type: ACTION_SET_REC_STATUS, status });
  static setRecordingSid = (sid) => ({ type: ACTION_SET_REC_SID, sid });
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
    default:
      return state;
  }
};
