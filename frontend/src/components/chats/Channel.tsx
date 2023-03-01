import { useNavigate } from 'react-router-dom';
import { useRecoilValue } from 'recoil';
import instance from '../../util/Axios';
import { myIdState } from '../../util/Recoils';
import { ChannelInfo } from './interface';

interface ChannelProps {
  channel: ChannelInfo;
  isJoined: boolean;
}

function Channel({ channel, isJoined }: ChannelProps) {
  const myId = useRecoilValue(myIdState);
  const { channelId, channelName, isDm, memberCount, accessMode, unseenCount } =
    channel;
  const nav = useNavigate();

  const icon =
    accessMode === 'public' ? '🌎' : accessMode === 'protected' ? '🔐' : '🚧';

  const handleClick = () => {
    if (isJoined) {
      return nav(`/chats/${channelId}`);
    }
    if (accessMode === 'protected') {
      alert('비번 입력 모달');
    }
    instance
      .put(`/chats/${channelId}/user/${myId}`)
      .then(() => nav(`/chats/${channelId}`))
      .catch(err => alert(`히히 못들어가! ${err.response.status}`));
  };

  // TODO : Link 대신 적절한 방 입장 요청을 보내야함, protected 면 비번 입력 모달
  return (
    <div className={`channel${isDm ? ' channelDm' : ''}`} onClick={handleClick}>
      <div className="channelName xlarge">방제: {channelName}</div>
      <div className="channelUnseen small">
        {unseenCount === undefined ? '' : `📨 : ${unseenCount}`}
      </div>
      <div className="channelMemberCount small">{memberCount} 명</div>
      <div className="channelAccessMode small">{icon}</div>
    </div>
  );
}

export default Channel;
