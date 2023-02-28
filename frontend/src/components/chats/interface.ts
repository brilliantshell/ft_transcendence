export interface ChannelInfo {
  channelId: number;
  channelName: string;
  memberCount: number;
  accessMode: string;
  isDm?: boolean;
  unseenCount?: number;
}

export interface Channels {
  joinedChannels: ChannelInfo[];
  otherChannels: ChannelInfo[];
}
