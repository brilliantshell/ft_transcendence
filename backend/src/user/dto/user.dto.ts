import { UserId } from '../../../src/util/type';

export interface UserProfileDto {
  nickname: string;
  profileImage: string;
}

export interface FriendListDto {
  friends: UserId[];
}
