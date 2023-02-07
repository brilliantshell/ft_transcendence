import { Relationship, UserId } from '../../util/type';

export interface UserRelationshipDto {
  relationship: Relationship | 'normal';
  userId: UserId;
}
