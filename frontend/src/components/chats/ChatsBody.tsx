import { lazy, Suspense } from 'react';
import { ChannelInfo } from './interface';

interface ChatsJoinedProps {
  channels: ChannelInfo[];
  isJoined: boolean;
}

const Channel = lazy(() => import('./Channel'));

function ChatsBody({ channels, isJoined }: ChatsJoinedProps) {
  return (
    <div className="chatsBody">
      <Suspense fallback={<div>로딩중이란다~ {/* TODO : 적절한 spin */}</div>}>
        {channels.map(channel => (
          <Channel key={channel.channelId} channel={channel} isJoined={isJoined} />
        ))}
      </Suspense>
    </div>
  );
}

export default ChatsBody;
