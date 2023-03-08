import { useEffect } from 'react';
import { socket } from '../../../util/Socket';
import { ChannelInfo } from '../interface';

interface ChannelId {
  channelId: number;
}

interface ChannelCreated extends ChannelId {
  channelName: string;
  accessMode: 'public' | 'protected' | 'private';
}

interface MemberChange extends ChannelId {
  memberCountDiff: 1 | -1;
}

function AddToOtherChannels(
  prevOtherChannels: ChannelInfo[],
  { channelId, channelName, accessMode }: ChannelCreated,
) {
  const newChannelPos = prevOtherChannels.findIndex(
    prev => Intl.Collator('ko').compare(channelName, prev.channelName) < 0,
  );
  return newChannelPos === -1
    ? prevOtherChannels.concat({
        channelId,
        channelName,
        accessMode,
        memberCount: 1,
      })
    : prevOtherChannels
        .slice(0, newChannelPos)
        .concat({
          channelId,
          channelName,
          accessMode,
          memberCount: 1,
        })
        .concat(prevOtherChannels.slice(newChannelPos));
}

export function useChannelCreatedEvent(
  setOtherChannels: React.Dispatch<React.SetStateAction<ChannelInfo[]>>,
) {
  const handleChannelCreated = (newChannel: ChannelCreated) => {
    setOtherChannels(prev => AddToOtherChannels(prev, newChannel));
  };
  useEffect(() => {
    socket.on('channelCreated', handleChannelCreated);
    return () => {
      socket.off('channelCreated');
    };
  }, []);
}

export function useChannelDeletedEvent(
  setJoinedChannels: React.Dispatch<React.SetStateAction<ChannelInfo[]>>,
  setOtherChannels: React.Dispatch<React.SetStateAction<ChannelInfo[]>>,
) {
  const handleChannelDeleted = ({ channelId }: ChannelId) => {
    let updated = false;
    setJoinedChannels(prev =>
      prev.filter(channel => {
        if (channel.channelId === channelId) {
          updated = true;
          return false;
        }
        return true;
      }),
    );
    !updated &&
      setOtherChannels(prev =>
        prev.filter(channel => channel.channelId !== channelId),
      );
  };
  useEffect(() => {
    socket.on('channelDeleted', handleChannelDeleted);
    return () => {
      socket.off('channelDeleted');
    };
  }, []);
}

export function useChannelUpdatedEvent(
  setJoinedChannels: React.Dispatch<React.SetStateAction<ChannelInfo[]>>,
  setOtherChannels: React.Dispatch<React.SetStateAction<ChannelInfo[]>>,
) {
  const handleChannelUpdated = ({
    channelId,
    memberCountDiff,
  }: MemberChange) => {
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
  };
  useEffect(() => {
    socket.on('channelUpdated', handleChannelUpdated);
    return () => {
      socket.off('channelUpdated');
    };
  }, []);
}

export function useMessageArrivedEvent(
  setJoinedChannels: React.Dispatch<React.SetStateAction<ChannelInfo[]>>,
) {
  const handleMessageArrived = ({ channelId }: ChannelId) => {
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
  };

  useEffect(() => {
    socket.on('messageArrived', handleMessageArrived);
    return () => {
      socket.off('messageArrived');
    };
  }, []);
}

export function useBannedEvent(
  setJoinedChannels: React.Dispatch<React.SetStateAction<ChannelInfo[]>>,
  setOtherChannels: React.Dispatch<React.SetStateAction<ChannelInfo[]>>,
) {
  const handleBanned = ({ channelId }: ChannelId) => {
    let newChannel: ChannelInfo;
    setJoinedChannels(prev => {
      const bannedChannelIdx = prev.findIndex(
        channel => channel.channelId === channelId,
      );
      if (bannedChannelIdx === -1) {
        return prev;
      }
      newChannel = prev[bannedChannelIdx];
      return prev
        .slice(0, bannedChannelIdx)
        .concat(prev.slice(bannedChannelIdx + 1));
    });
    setOtherChannels(prev => AddToOtherChannels(prev, newChannel));
  };
  useEffect(() => {
    socket.on('banned', handleBanned);
    return () => {
      socket.off('banned');
    };
  }, []);
}
