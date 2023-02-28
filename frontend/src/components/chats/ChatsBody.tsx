import { lazy, Suspense } from 'react';
import { ChannelInfo } from './interface';

interface ChatsJoinedProps {
  channels: ChannelInfo[];
}

const Channel = lazy(() => import('./Channel'));

function ChatsBody({ channels }: ChatsJoinedProps) {
  return (
    <div className="chatsBody">
      <Suspense fallback={<div>로딩중이란다~ {/* TODO : 적절한 spin */}</div>}>
        {channels.map(channel => (
          <Channel key={channel.channelId} channel={channel} />
        ))}
      </Suspense>
    </div>
  );
}

export default ChatsBody;
