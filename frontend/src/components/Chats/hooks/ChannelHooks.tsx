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

interface ChannelShown extends ChannelCreated {
  memberCount: number;
}

interface ChannelUpdated extends ChannelId {
  memberCountDiff: 1 | 0 | -1;
  accessMode: 'public' | 'protected' | 'private' | null;
}

function addToOtherChannels(
  prevOtherChannels: ChannelInfo[],
  { channelId, channelName, accessMode, memberCount }: ChannelShown,
) {
  const newChannelPos = prevOtherChannels.findIndex(
    prev => Intl.Collator('ko').compare(channelName, prev.channelName) < 0,
  );
  return newChannelPos === -1
    ? prevOtherChannels.concat({
        channelId,
        channelName,
        accessMode,
        memberCount,
      })
    : prevOtherChannels
        .slice(0, newChannelPos)
        .concat({
          channelId,
          channelName,
          accessMode,
          memberCount,
        })
        .concat(prevOtherChannels.slice(newChannelPos));
}

export function useChannelCreatedEvent(
  setOtherChannels: React.Dispatch<React.SetStateAction<ChannelInfo[]>>,
) {
  const handleChannelCreated = (channel: ChannelCreated) => {
    setOtherChannels(prev =>
      addToOtherChannels(prev, { ...channel, memberCount: 1 }),
    );
  };
  useEffect(() => {
    socket.on('channelCreated', handleChannelCreated);
    return () => {
      socket.off('channelCreated');
    };
  }, []);
}

export function useChannelShownEvent(
  joinedChannels: ChannelInfo[],
  setOtherChannels: React.Dispatch<React.SetStateAction<ChannelInfo[]>>,
) {
  const handleChannelShown = (channel: ChannelShown) => {
    if (joinedChannels.findIndex(c => c.channelId === channel.channelId) < 0) {
      setOtherChannels(prev => addToOtherChannels(prev, channel));
    }
  };

  useEffect(() => {
    socket.on('channelShown', handleChannelShown);
    return () => {
      socket.off('channelShown');
    };
  }, []);
}

export function useChannelHiddenEvent(
  joinedChannels: ChannelInfo[],
  setOtherChannels: React.Dispatch<React.SetStateAction<ChannelInfo[]>>,
) {
  const handleChannelHidden = ({ channelId }: ChannelId) => {
    if (joinedChannels.findIndex(c => c.channelId === channelId) < 0) {
      setOtherChannels(prev => prev.filter(c => c.channelId !== channelId));
    }
  };

  useEffect(() => {
    socket.on('channelHidden', handleChannelHidden);
    return () => {
      socket.off('channelHidden');
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
    accessMode,
  }: ChannelUpdated) => {
    let updated = false;
    setJoinedChannels(prev =>
      prev.map(channel => {
        if (channel.channelId === channelId) {
          updated = true;
          return {
            ...channel,
            memberCount: channel.memberCount + memberCountDiff,
            accessMode: accessMode || channel.accessMode,
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
                accessMode: accessMode || channel.accessMode,
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
    setJoinedChannels(prev => {
      const bannedChannelIdx = prev.findIndex(
        channel => channel.channelId === channelId,
      );
      if (bannedChannelIdx === -1) {
        return prev;
      }
      const newChannel = prev[bannedChannelIdx];
      setOtherChannels(prev => addToOtherChannels(prev, newChannel));
      return prev
        .slice(0, bannedChannelIdx)
        .concat(prev.slice(bannedChannelIdx + 1));
    });
  };
  useEffect(() => {
    socket.on('banned', handleBanned);
    return () => {
      socket.off('banned');
    };
  }, []);
}

export function useChannelInvitedEvent(
  setJoinedChannels: React.Dispatch<React.SetStateAction<ChannelInfo[]>>,
  setOtherChannels: React.Dispatch<React.SetStateAction<ChannelInfo[]>>,
) {
  const handleChannelInvited = ({ channelId }: ChannelId) => {
    setOtherChannels(prev => {
      const invitedChannelIdx = prev.findIndex(c => c.channelId === channelId);
      if (invitedChannelIdx === -1) {
        return prev;
      }
      const newChannel = prev[invitedChannelIdx];
      setJoinedChannels(prev =>
        [{ ...newChannel, unseenCount: 0 } as ChannelInfo].concat(prev),
      );
      return prev
        .slice(0, invitedChannelIdx)
        .concat(prev.slice(invitedChannelIdx + 1));
    });
  };
  useEffect(() => {
    socket.on('channelInvited', handleChannelInvited);
    return () => {
      socket.off('channelInvited');
    };
  }, []);
}
