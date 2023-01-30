import { Activity, Relationship, UserId } from '../../util/type';

export interface UserInfoDto {
  activity: Activity;
  gameId: number;
  relationship: Relationship | 'normal';
  userId: UserId;
}

export interface FriendAcceptedDto {
  newFriendId: UserId;
}

export interface FriendDeclinedDto {
  declinedBy: UserId;
}

export interface FriendCancelledDto {
  cancelledBy: UserId;
}

export interface PendingFriendRequestDto {
  isPending: boolean;
}

export interface FriendRemovedDto {
  removedBy: UserId;
}

export interface BlockedDto {
  blockedBy: UserId;
}

export interface UnblockedDto {
  unblockedBy: UserId;
}
