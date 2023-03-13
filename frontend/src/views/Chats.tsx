import { useEffect, useState } from 'react';
import { ChannelInfo, Channels } from '../components/chats/interface';
import ChatsFrame from '../components/chats/ChatsFrame';
import ChatsBody from '../components/chats/ChatsBody';
import instance from '../util/Axios';
import { ErrorAlert } from '../util/Alert';
import { socket } from '../util/Socket';
import {
  useBannedEvent,
  useChannelCreatedEvent,
  useChannelDeletedEvent,
  useChannelHiddenEvent,
  useChannelInvitedEvent,
  useChannelShownEvent,
  useChannelUpdatedEvent,
  useMessageArrivedEvent,
} from '../components/chats/hooks/ChannelHooks';
import { useCurrentUi } from '../components/hooks/CurrentUi';

function Chats() {
  const [joinedChannels, setJoinedChannels] = useState<ChannelInfo[]>([]);
  const [otherChannels, setOtherChannels] = useState<ChannelInfo[]>([]);
  const [isEmpty, setIsEmpty] = useState<[boolean, boolean]>([false, false]);
  const [isConnected, setIsConnected] = useState(socket.connected);

  useCurrentUi(isConnected, setIsConnected, 'chats');

  useEffect(() => {
    isConnected &&
      instance
        .get<Channels>('/chats')
        .then(({ data: { joinedChannels, otherChannels } }) => {
          joinedChannels.length === 0
            ? setIsEmpty(prev => [true, prev[1]])
            : setJoinedChannels(joinedChannels);
          otherChannels.length === 0
            ? setIsEmpty(prev => [prev[0], true])
            : setOtherChannels(otherChannels);
        })
        .catch(() => ErrorAlert('채널 목록 로딩 실패', '오류가 발생했습니다.'));
  }, [isConnected]);

  useChannelCreatedEvent(setOtherChannels);
  useChannelShownEvent(joinedChannels, setOtherChannels);
  useChannelHiddenEvent(joinedChannels, setOtherChannels);
  useChannelDeletedEvent(setJoinedChannels, setOtherChannels);
  useChannelUpdatedEvent(setJoinedChannels, setOtherChannels);
  useChannelInvitedEvent(setJoinedChannels, setOtherChannels);
  useMessageArrivedEvent(setJoinedChannels);
  useBannedEvent(setJoinedChannels, setOtherChannels);

  return (
    <div className="chats">
      <ChatsFrame purpose={'chatsJoined'}>
        <ChatsBody
          channels={joinedChannels}
          isJoined={true}
          isEmpty={isEmpty[0]}
        />
      </ChatsFrame>
      <ChatsFrame purpose={'chatsAll'}>
        <ChatsBody
          channels={otherChannels}
          isJoined={false}
          isEmpty={isEmpty[1]}
        />
      </ChatsFrame>
    </div>
  );
}

export default Chats;
