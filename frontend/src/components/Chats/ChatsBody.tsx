import { lazy, Suspense } from 'react';
import { ChannelInfo } from './interface';

const Channel = lazy(() => import('./Channel'));

interface ChatsJoinedProps {
  channels: ChannelInfo[];
  isJoined: boolean;
  isEmpty: boolean;
}

function ChatsBody({ channels, isJoined, isEmpty }: ChatsJoinedProps) {
  return (
    <div className="chatsBody">
      <Suspense fallback={<div className="chatsListSpin"></div>}>
        {isEmpty ? (
          <h2 className="chatsBody">채널이 없어요~</h2>
        ) : (
          channels.map(channel => (
            <Channel
              key={channel.channelId}
              channel={channel}
              isJoined={isJoined}
            />
          ))
        )}
      </Suspense>
    </div>
  );
}

export default ChatsBody;
