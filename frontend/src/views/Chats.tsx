import { useEffect, useState } from 'react';
import { Channels } from '../components/chats/interface';
import ChatsFrame from '../components/chats/ChatsFrame';
import ChatsBody from '../components/chats/ChatsBody';
import instance from '../util/Axios';
import { socket, listenEvent } from '../util/Socket';
import { ErrorAlert } from '../util/Alert';
import '../style/Chats.css';

interface MemberChange {
  channelId: number;
  memberCountDiff: 1 | -1;
}

interface MessageArrived {
  channelId: number;
}

interface ChannelCreated {
  channelId: number;
  name: string;
  accessMode: 'public' | 'protected' | 'private';
}

function Chats() {
  const [joinedChannels, setJoinedChannels] = useState<
    Channels['joinedChannels']
  >([]);
  const [otherChannels, setOtherChannels] = useState<Channels['otherChannels']>(
    [],
  );

  useEffect(() => {
    (async () => {
      socket.disconnected &&
        (await new Promise((resolve: any) => socket.on('connect', resolve)));
      socket.emit('currentUi', { ui: 'chats' });
      try {
        const { joinedChannels, otherChannels } = (
          await instance.get<Channels>('/chats')
        ).data;
        setJoinedChannels(joinedChannels);
        setOtherChannels(otherChannels);
      } catch (err) {
        ErrorAlert('채널 목록 로딩 실패', '오류가 발생했습니다.');
      }
    })();
  }, []);

  useEffect(() => {
    listenEvent<ChannelCreated>('channelCreated').then(
      ({ channelId, name, accessMode }) => {
        setOtherChannels(prev => {
          const idx = prev.findIndex(
            channel =>
              Intl.Collator('ko').compare(name, channel.channelName) === -1,
          );
          return idx === -1
            ? prev.concat({
                channelId,
                channelName: name,
                accessMode,
                memberCount: 1,
              })
            : [
                ...prev.slice(0, idx),
                { channelId, channelName: name, accessMode, memberCount: 1 },
                ...prev.slice(idx + 1),
              ];
        });
      },
    );
    return () => {
      socket.off('channelCreated');
    };
  }, [otherChannels]);

  useEffect(() => {
    listenEvent<{ channelId: number }>('channelDeleted').then(({ channelId }) =>
      setOtherChannels(prev =>
        prev.filter(channel => channel.channelId !== channelId),
      ),
    );
    return () => {
      socket.off('channelDeleted');
    };
  }, [otherChannels]);

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

  useEffect(() => {
    listenEvent<MessageArrived>('messageArrived').then(({ channelId }) => {
      setJoinedChannels(prev => {
        // find channel and shift to top
        const channelIdx = prev.findIndex(
          channel => channel.channelId === channelId,
        );
        const ArrivedChannel = prev.splice(channelIdx, 1)[0];
        return [
          {
            ...ArrivedChannel,
            unseenCount: (ArrivedChannel.unseenCount as number) + 1,
          },
          ...prev,
        ];
      });
    });
    return () => {
      socket.off('messageArrived');
    };
  }, [joinedChannels]);

  return (
    <div className="chats">
      <ChatsFrame purpose={'chatsJoined'}>
        <ChatsBody channels={joinedChannels} isJoined={true} />
      </ChatsFrame>
      <ChatsFrame purpose={'chatsAll'}>
        <ChatsBody channels={otherChannels} isJoined={false} />
      </ChatsFrame>
    </div>
  );
}

export default Chats;
