import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useRecoilValue } from 'recoil';
import instance from '../../util/Axios';
import { myIdState } from '../../util/Recoils';
import FormModal from './FormModal';
import { ChannelInfo } from './interface';
import PasswordForm from './PasswordForm';

interface ChannelProps {
  channel: ChannelInfo;
  isJoined: boolean;
}

function Channel({ channel, isJoined }: ChannelProps) {
  const [showModal, setShowModal] = useState<boolean>(false);
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
      setShowModal(true);
    } else
      instance
        .put(`/chats/${channelId}/user/${myId}`)
        .then(() => nav(`/chats/${channelId}`))
        .catch(err => alert(`히히 못들어가! ${err.response.status}`));
  };

  return (
    <div className={`channel${isDm ? ' channelDm' : ''}`} onClick={handleClick}>
      <div className="channelName xlarge">방제: {channelName}</div>
      <div className="channelUnseen small">
        {unseenCount === undefined ? '' : `📨 : ${unseenCount}`}
      </div>
      <div className="channelMemberCount small">{memberCount} 명</div>
      <div className="channelAccessMode small">{icon}</div>
      {showModal &&
        createPortal(
          <FormModal
            title={'비밀번호를 입력해주세요'}
            form={
              <PasswordForm
                channelId={channelId}
                myId={myId}
                hidden={() => setShowModal(false)}
              />
            }
            hidden={() => {
              setShowModal(false);
            }}
          />,
          document.body,
        )}
    </div>
  );
}

export default Channel;
