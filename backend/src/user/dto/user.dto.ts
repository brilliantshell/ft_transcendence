import { UserId } from '../../../src/util/type';

export interface UserProfileDto {
  nickname: string;
  isDefaultImage: boolean;
}

export interface FriendListDto {
  friends: UserId[];
}

export interface UserIdDto {
  userId: UserId;
}
