import { useEffect, useState } from 'react';
import { Channels } from '../components/chats/interface';
import ChatsFrame from '../components/chats/ChatsFrame';
import ChatsBody from '../components/chats/ChatsBody';
import instance from '../util/Axios';
import { ErrorAlert } from '../util/Alert';
import socket, { listenEvent } from '../util/Socket';
import '../style/Chats.css';

interface MemberChange {
  channelId: number;
  memberCountDiff: 1 | -1;
}

interface MessageArrived {
  channelId: number;
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
    listenEvent<MemberChange>('channelUpdated').then(
      ({ channelId, memberCountDiff }) => {
        console.log('channelUpdated', channelId, memberCountDiff);
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
      console.log('messageArrived', channelId);
      setJoinedChannels(prev =>
        prev.map(channel =>
          channel.channelId === channelId
            ? {
                ...channel,
                unseenCount: (channel.unseenCount as number) + 1,
              }
            : channel,
        ),
      );
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
