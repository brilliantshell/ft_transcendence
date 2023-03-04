import { lazy, Suspense } from 'react';
import ChannelCreate from './ChannelCreate';
import { ChannelInfo } from './interface';

const Channel = lazy(() => import('./Channel'));

interface ChatsJoinedProps {
  channels: ChannelInfo[];
  isJoined: boolean;
}

function ChatsBody({ channels, isJoined }: ChatsJoinedProps) {
  return (
    <div className="chatsBody">
      <Suspense fallback={<div className="chatsListSpin"></div>}>
        {channels.length > 0
          ? channels.map(channel => (
              <Channel
                key={channel.channelId}
                channel={channel}
                isJoined={isJoined}
              />
            ))
          : '채널이 없어요~'}
      </Suspense>
      {isJoined === false && <ChannelCreate />}
    </div>
  );
}

export default ChatsBody;
