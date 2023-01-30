import { ChannelId } from '../../util/type';

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

// TODO : receive DTO / send DTO 어떻게 할지 생각하기
export interface NewChannelDto {
  channelName: string;
  password?: string;
  accessMode: 'public' | 'protected' | 'private';
}
