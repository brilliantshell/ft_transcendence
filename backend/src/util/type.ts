import { DateTime } from 'luxon';
import { IncomingMessage } from 'http';
import { Request } from 'express';
import { Socket } from 'socket.io';
import { Subscription } from 'rxjs';

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

// SECTION : Game

export type Score = 0 | 1 | 2 | 3 | 4 | 5;

export class BallCoordinates {
  x = 0.5;
  y = 0.5;
}

export class BallVelocity {
  vx = 0.004;
  vy = 0.004;
}

export class PaddlePositions {
  leftY = 0.5 - 0.08333;
  rightY = 0.5 - 0.08333;
}

export class GameData {
  ballCoords = new BallCoordinates();
  ballVelocity = new BallVelocity();
  intervalId: NodeJS.Timer | null = null;
  paddlePositions = new PaddlePositions();
  scores: [Score, Score] = [0, 0];
  subscription: Subscription | null = null;
}

export class GameInfo {
  constructor(
    leftId: UserId,
    rightId: UserId,
    mode: 0 | 1 | 2,
    isRank: boolean,
  ) {
    this.leftId = leftId;
    this.rightId = rightId;
    this.mode = mode;
    this.isRank = isRank;
  }

  isRank: boolean;
  leftId: UserId;
  leftNickname?: string;
  rightId: UserId;
  rightNickname?: string;
  mode: 0 | 1 | 2;
  isStarted = false;
  gameData = new GameData();
}

// SECTION : User verification

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

export interface VerifiedWsRequest extends IncomingMessage {
  user: { userId: UserId; accessToken?: string; refreshToken?: string };
}

export interface VerifiedSocket extends Socket {
  request: VerifiedWsRequest;
}

export interface RefreshTokenWrapper {
  token: string;
  isRevoked: boolean;
}

export interface JwtPayload {
  userId: UserId;
}

export interface TwoFactorAuthData {
  email: string;
  authCode: string;
}
