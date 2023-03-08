import { useEffect, useState } from 'react';
import { Channels } from '../components/chats/interface';
import ChatsFrame from '../components/chats/ChatsFrame';
import ChatsBody from '../components/chats/ChatsBody';
import instance from '../util/Axios';
import { ErrorAlert } from '../util/Alert';
import { socket } from '../util/Socket';
import {
  useChannelCreatedEvent,
  useChannelDeletedEvent,
  useChannelUpdatedEvent,
  useMessageArrivedEvent,
} from '../components/chats/hooks/ChannelHooks';
import { useCurrentUi } from '../components/hooks/EmitCurrentUi';
import '../style/Chats.css';

function Chats() {
  const [joinedChannels, setJoinedChannels] = useState<
    Channels['joinedChannels']
  >([]);
  const [otherChannels, setOtherChannels] = useState<Channels['otherChannels']>(
    [],
  );
  const [isConnected, setIsConnected] = useState(socket.connected);

  useCurrentUi(isConnected, setIsConnected, 'chats');

  useEffect(() => {
    isConnected &&
      instance
        .get<Channels>('/chats')
        .then(({ data: { joinedChannels, otherChannels } }) => {
          setJoinedChannels(joinedChannels);
          setOtherChannels(otherChannels);
        })
        .catch(() => ErrorAlert('채널 목록 로딩 실패', '오류가 발생했습니다.'));
  }, [isConnected]);

  useChannelCreatedEvent({ otherChannels, setOtherChannels });
  useChannelDeletedEvent(
    { joinedChannels, setJoinedChannels },
    { otherChannels, setOtherChannels },
  );
  useChannelUpdatedEvent(
    { joinedChannels, setJoinedChannels },
    { otherChannels, setOtherChannels },
  );
  useMessageArrivedEvent({ joinedChannels, setJoinedChannels });

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
