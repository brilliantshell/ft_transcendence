
export interface joinedChannel {
  channelId: number;
  isDm: boolean;
  channelName: string;
  memberCount: number;
  accessMode: string;
  unseenCount: number;
}

export interface otherChannel {
  channelId: number;
  channelName: string;
  memberCount: number;
  accessMode: string;
}

export interface ChannelInfo extends Partial<joinedChannel> {} ;

export interface Channels {
  joinedChannels: joinedChannel[];
  otherChannels: otherChannel[];
}
