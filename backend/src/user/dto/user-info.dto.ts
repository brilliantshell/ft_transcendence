import { Activity, Relationship, UserId } from '../../util/type';

export interface UserInfoDto {
  activity: Activity;
  gameId: number;
  relationship: Relationship | 'normal';
  userId: UserId;
}
