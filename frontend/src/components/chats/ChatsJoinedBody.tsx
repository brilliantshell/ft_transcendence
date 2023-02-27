import { lazy, Suspense } from 'react';
import { joinedChannel } from './interface';

interface ChatsJoinedProps {
  joinedChannels: joinedChannel[];
}

const Channel = lazy(() => import('./Channel'));

function ChatsJoinedBody({ joinedChannels }: ChatsJoinedProps) {
  return (
    <div className="chatsBaseBody">
      <Suspense fallback={<div>로딩중이란다~ </div>}>
        {joinedChannels.map(channel => (
          <Channel key={channel.channelId} channel={channel} />
        ))}
      </Suspense>
    </div>
  );
}

export default ChatsJoinedBody;
