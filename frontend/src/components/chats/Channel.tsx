import { Link } from 'react-router-dom';
import { ChannelInfo } from './interface';

interface ChannelProps {
  channel: ChannelInfo;
}

function Channel({ channel }: ChannelProps) {
  const { channelId, channelName, isDm, memberCount, accessMode, unseenCount } =
    channel;

  const icon =
    accessMode === 'public' ? '🌎' : accessMode === 'protected' ? '🔐' : '🚧';

  // TODO : Link 대신 적절한 방 입장 요청을 보내야함, protected 면 비번 입력 모달
  return (
    <Link className={`channel${isDm ? ' Dm' : ''}`} to={`/chats/${channelId}`}>
      <div className="channelName xlarge">방제: {channelName}</div>
      <div className="channelUnseen small">
        {unseenCount === undefined ? '' : `📨 : ${unseenCount}`}
      </div>
      <div className="channelMemberCount small">{memberCount} 명</div>
      <div className="channelAccessMode small">{icon}</div>
    </Link>
  );
}

export default Channel;
