import { useEffect } from 'react';
import { listenEvent, socket } from '../../../util/Socket';
import { ChannelInfo, Channels } from '../interface';

interface ChannelId {
  channelId: number;
}

interface ChannelCreated extends ChannelId {
  name: string;
  accessMode: 'public' | 'protected' | 'private';
}
interface MemberChange extends ChannelId {
  memberCountDiff: 1 | -1;
}

interface JoinedChannelsState {
  joinedChannels: Channels['joinedChannels'];
  setJoinedChannels: React.Dispatch<
    React.SetStateAction<Channels['joinedChannels']>
  >;
}

interface OtherChannelsState {
  otherChannels: Channels['otherChannels'];
  setOtherChannels: React.Dispatch<
    React.SetStateAction<Channels['otherChannels']>
  >;
}

export function useChannelCreatedEvent({
  otherChannels,
  setOtherChannels,
}: OtherChannelsState) {
  useEffect(() => {
    listenEvent<ChannelCreated>('channelCreated').then(
      ({ channelId, name, accessMode }) => {
        setOtherChannels(prev => {
          const newChannelPos = prev.findIndex(
            channel =>
              Intl.Collator('ko').compare(name, channel.channelName) < 0,
          );
          return newChannelPos === -1
            ? prev.concat({
                channelId,
                channelName: name,
                accessMode,
                memberCount: 1,
              })
            : prev
                .slice(0, newChannelPos)
                .concat({
                  channelId,
                  channelName: name,
                  accessMode,
                  memberCount: 1,
                })
                .concat(prev.slice(newChannelPos));
        });
      },
    );
    return () => {
      socket.off('channelCreated');
    };
  }, [otherChannels]);
}

export function useChannelDeletedEvent({
  otherChannels,
  setOtherChannels,
}: OtherChannelsState) {
  useEffect(() => {
    listenEvent<ChannelId>('channelDeleted').then(({ channelId }) =>
      setOtherChannels(prev =>
        prev.filter(channel => channel.channelId !== channelId),
      ),
    );
    return () => {
      socket.off('channelDeleted');
    };
  }, [otherChannels]);
}

export function useChannelUpdatedEvent(
  { joinedChannels, setJoinedChannels }: JoinedChannelsState,
  { otherChannels, setOtherChannels }: OtherChannelsState,
) {
  useEffect(() => {
    listenEvent<MemberChange>('channelUpdated').then(
      ({ channelId, memberCountDiff }) => {
        let updated = false;
        setJoinedChannels(prev =>
          prev.map(channel => {
            if (channel.channelId === channelId) {
              updated = true;
              return {
                ...channel,
                memberCount: channel.memberCount + memberCountDiff,
              };
            }
            return channel;
          }),
        );
        !updated &&
          setOtherChannels(prev =>
            prev.map(channel =>
              channel.channelId === channelId
                ? {
                    ...channel,
                    memberCount: channel.memberCount + memberCountDiff,
                  }
                : channel,
            ),
          );
      },
    );
    return () => {
      socket.off('channelUpdated');
    };
  }, [joinedChannels, otherChannels]);
}

export function useMessageArrivedEvent({
  joinedChannels,
  setJoinedChannels,
}: JoinedChannelsState) {
  useEffect(() => {
    listenEvent<ChannelId>('messageArrived').then(({ channelId }) => {
      setJoinedChannels(prev => {
        const arrivedChannelIdx = prev.findIndex(
          channel => channel.channelId === channelId,
        );
        if (arrivedChannelIdx === -1) {
          return prev;
        }
        const arrivedChannel = prev[arrivedChannelIdx];
        return [
          {
            ...arrivedChannel,
            unseenCount: (arrivedChannel.unseenCount as number) + 1,
          } as ChannelInfo,
        ]
          .concat(prev.slice(0, arrivedChannelIdx))
          .concat(prev.slice(arrivedChannelIdx + 1));
      });
    });
    return () => {
      socket.off('messageArrived');
    };
  }, [joinedChannels]);
}
