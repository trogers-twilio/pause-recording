import { ParticipantType, ParticipantStatus } from '../enums';

export const getMyLiveParticipant = (participants = []) => {
  return participants.find(p => 
    p.isMyself
    && p.status === ParticipantStatus.joined
  );
};

export const getCustomerLiveParticipant = (participants = []) => {
  return participants.find(p => 
    p.participantType === ParticipantType.customer
    && p.status === ParticipantStatus.joined
  );
};
