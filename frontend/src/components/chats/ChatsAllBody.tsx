import { lazy, Suspense } from 'react';
import { otherChannel } from './interface';

interface ChatsAllProps {
  otherChannels: otherChannel[];
}

const Channel = lazy(() => import('./Channel'));

function ChatsAllBody({ otherChannels }: ChatsAllProps) {
  return (
    <div className="chatsBaseBody">
      <Suspense fallback={<div>로딩중이란다~</div>}>
        {otherChannels.map(channel => (
          <Channel key={channel.channelId} channel={channel} />
        ))}
      </Suspense>
    </div>
  );
}

export default ChatsAllBody;
