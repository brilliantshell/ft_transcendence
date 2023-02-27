import ChatsAllBody from './ChatsAllBody';
import ChatsBase from './ChatsBase';
import { otherChannel } from './interface';

interface ChatsAllProps {
  otherChannels: otherChannel[];
}

function ChatsAll({ otherChannels }: ChatsAllProps) {
  return (
    <ChatsBase purpose="chatsAll">
      <div className="chatsBaseHeader">ChatsJoined</div>
      <ChatsAllBody otherChannels={otherChannels} />
    </ChatsBase>
  );
}

export default ChatsAll;
