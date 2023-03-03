import { useEffect, useState } from 'react';
import { Channels } from '../components/chats/interface';
import ChatsFrame from '../components/chats/ChatsFrame';
import ChatsBody from '../components/chats/ChatsBody';
import instance from '../util/Axios';
import { socket } from '../util/Socket';
import '../style/Chats.css';
import { AxiosError } from 'axios';
import { ErrorAlert } from '../util/Alert';

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
