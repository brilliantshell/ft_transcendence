import { DateTime } from 'luxon';

import { ChannelId, UserId, UserRole } from '../../util/type';

export interface MemberJoinedMessage {
  joinedMember: UserId;
}

export interface NewMessage {
  senderId: UserId;
  content: string;
  sentAt: DateTime;
}

export interface LeftMessage {
  leftMember: UserId;
  isOwner: boolean;
}

export interface RoleChangedMessage {
  changedMember: UserId;
  newRole: Exclude<UserRole, 'owner'>;
}

export interface MutedMessage {
  channelId: ChannelId;
  muteEndAt: DateTime;
}
