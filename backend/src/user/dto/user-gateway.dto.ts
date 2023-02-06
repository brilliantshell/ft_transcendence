import { Activity, Relationship, UserId } from '../../util/type';

export interface UserActivityDto {
  activity: Activity;
  gameId: number;
  userId: UserId;
}

export interface UserRelationshipDto {
  relationship: Relationship | 'normal';
  userId: UserId;
}
