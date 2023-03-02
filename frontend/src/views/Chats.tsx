import { useEffect, useState } from 'react';
import { Channels } from '../components/chats/interface';
import ChatsFrame from '../components/chats/ChatsFrame';
import ChatsBody from '../components/chats/ChatsBody';
import instance from '../util/Axios';
import socket from '../util/Socket';
import '../style/Chats.css';

function Chats() {
  const [joinedChannels, setJoinedChannels] = useState<
    Channels['joinedChannels']
  >([]);
  const [otherChannels, setOtherChannels] = useState<Channels['otherChannels']>(
    [],
  );
  // const [error, setError] = useState<string>('');

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
      } catch (err: any) {
        console.log(err);
        // TODO:  error handling 및 채널이 없을 시 적절한 메시지 렌더링
      }
    })();
  }, []);
  // TODO : 누군가 채널 생성시 socket event 로 추가하기
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
