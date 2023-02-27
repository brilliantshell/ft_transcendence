import { Link } from 'react-router-dom';
import { ChannelInfo } from './interface';

interface ChannelProps {
  channel: ChannelInfo;
}

function Channel({ channel }: ChannelProps) {
  const { channelId, channelName, isDm, memberCount, accessMode, unseenCount } =
    channel;
  return (
    <Link
      className={`channel${isDm ? 'Dm' : ''}`}
      to={`/chats/${channelId}`}
    >
      아름다운 채널 컴포넌트
      <div className="channelName">{channelName}</div>
      <div className="channelMemberCount">{memberCount} 명~</div>
      <div className="channelAccessMode">{accessMode}</div>
      {unseenCount && (
        <div className="channelUnseenCount">{unseenCount} 개 안읽씹중 </div>
      )}
    </Link>
  );
}

export default Channel;
