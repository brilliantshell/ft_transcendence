import { ChannelId, UserRole } from '../../util/type';

interface OtherChannel {
  channelId: ChannelId;
  channelName: string;
  memberCount: number;
  accessMode: 'public' | 'protected';
}

interface JoinedChannel extends Omit<OtherChannel, 'accessMode'> {
  accessMode: 'public' | 'protected' | 'private';
  unseenCount: number;
  isDm: boolean;
}

export interface AllChannelsDto {
  joinedChannels?: JoinedChannel[];
  otherChannels?: OtherChannel[];
}

// change to class
export interface NewChannelDto {
  channelName: string;
  password?: string;
  accessMode: 'public' | 'protected' | 'private';
}

interface ChannelMember {
  id: number;
  role: UserRole;
}

export interface ChannelInfoDto {
  channelsMembers: ChannelMember[];
  isReadonlyDm: boolean | null;
}
