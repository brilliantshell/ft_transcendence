import { DateTime } from 'luxon';
import { Request } from 'express';

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
  | `game-${GameId}`
  | 'profile'
  | 'ranks'
  | 'watchingGame'
  | 'waitingRoom';

export type Activity = 'online' | 'offline' | 'inGame';

export type Score = 0 | 1 | 2 | 3 | 4 | 5;

export class GameInfo {
  constructor(
    leftId: UserId,
    rightId: UserId,
    map: 1 | 2 | 3,
    isRank: boolean,
  ) {
    this.leftId = leftId;
    this.rightId = rightId;
    this.map = map;
    this.isRank = isRank;
    this.scores = null;
  }

  isRank: boolean;
  leftId: UserId;
  leftNickname?: string;
  rightId: UserId;
  rightNickname?: string;
  map: 1 | 2 | 3;
  scores: [Score, Score] | null;
}

export interface LoginUserInfo {
  userId: UserId;
  isRegistered: boolean;
  authEmail: string;
}

export interface LoginRequest extends Request {
  user: LoginUserInfo;
}

export interface VerifiedRequest extends Request {
  user: { userId: UserId };
}

export interface RelationshipRequest extends VerifiedRequest {
  relationship: Relationship | null;
  targetId: UserId;
}

export interface RefreshTokenWrapper {
  token: string;
  isRevoked: boolean;
}

export interface JwtPayload {
  userId: UserId;
}
