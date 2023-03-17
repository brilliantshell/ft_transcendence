import { DateTime } from 'luxon';

import { ChannelId, MessageId, UserId, UserRole } from '../../util/type';

export interface MemberJoinedMessage {
  joinedMember: UserId;
}

export interface NewMessage {
  senderId: UserId;
  messageId: MessageId;
  createdAt: DateTime;
  contents: string;
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
