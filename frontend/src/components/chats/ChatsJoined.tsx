import ChatsBase from './ChatsBase';
import ChatsJoinedBody from './ChatsJoinedBody';
import { joinedChannel } from './interface';

interface ChatsJoinedProps {
  joinedChannels: joinedChannel[];
}

function ChatsJoined({ joinedChannels }: ChatsJoinedProps) {
  console.log(joinedChannels);
  return (
    <ChatsBase purpose="chatsJoined">
      <div className="chatsBaseHeader">ChatsJoined</div>
      <ChatsJoinedBody joinedChannels={joinedChannels} />
    </ChatsBase>
  );
}

export default ChatsJoined;
