import { DateTime } from 'luxon';
import { Request } from 'express';
import { Users } from '../entity/users.entity';

export type UserId = number;

export type ChannelId = number;

export type GameId = string;

export type Friendship = 'friend' | 'pendingSender' | 'pendingReceiver';

export type BlockRelationship = 'blocker' | 'blocked';

export type Relationship = Friendship | BlockRelationship;

export type RelationshipAction = 'friendRequest' | 'block';

export type IsBlocked = boolean;

export type UserRole = 'owner' | 'admin' | 'member';

export type SocketId = string;

export interface ChannelInfo {
  modifiedAt: DateTime;
  userRoleMap: Map<UserId, UserRole>;
  accessMode: 'public' | 'protected' | 'private';
}

export interface UserChannelStatus {
  unseenCount: number;
  muteEndAt: DateTime | 'epoch';
}

export type CurrentUi =
  | 'chats'
  | `chatRooms-${ChannelId}`
  | 'playingGame'
  | 'profile'
  | 'ranks'
  | 'watchingGame'
  | 'waitingRoom';

export type Activity = 'online' | 'offline' | 'inGame';

export class GameInfo {
  constructor(leftUser: Users, rightUsers: Users, map, isRank: boolean) {
    this.leftId = leftUser.userId;
    this.leftNickname = leftUser.nickname;
    this.rightId = rightUsers.userId;
    this.rightNickname = rightUsers.nickname;
    this.map = map;
    this.isRank = isRank;
  }

  isRank: boolean;
  leftId: UserId;
  leftNickname: string;
  rightId: UserId;
  rightNickname: string;
  map: 1 | 2 | 3;
}

export interface VerifiedRequest extends Request {
  user: { userId: UserId };
}

export interface RelationshipRequest extends VerifiedRequest {
  relationship: Relationship | null;
  targetId: UserId;
}
