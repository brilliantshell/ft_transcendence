import { ReactNode, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useRecoilValue } from 'recoil';
import { ConfirmAlert, ErrorAlert } from '../../util/Alert';
import instance from '../../util/Axios';
import { myIdState } from '../../util/Recoils';
import FormModal from './FormModal';
import { ChannelInfo } from './interface';
import PasswordForm from './PasswordForm';
import {
  DmChannelIcon,
  MsgNotificationIcon,
  PrivateChannelIcon,
  ProtectedChannelIcon,
  UsersIcon,
} from './ChannelSvg';

interface ChannelProps {
  channel: ChannelInfo;
  isJoined: boolean;
}

const icons = {
  public: '',
  protected: <ProtectedChannelIcon />,
  private: <PrivateChannelIcon />,
  dm: <DmChannelIcon />,
};

function Channel({ channel, isJoined }: ChannelProps) {
  const [showModal, setShowModal] = useState<boolean>(false);
  const myId = useRecoilValue(myIdState);
  const { channelId, channelName, isDm, memberCount, accessMode, unseenCount } =
    channel;
  const nav = useNavigate();
  const icon: ReactNode = icons[isDm ? 'dm' : accessMode];

  const handleClick = () => {
    accessMode === 'protected' && isJoined !== true
      ? setShowModal(true)
      : ConfirmAlert(
          '채널에 입장하시겠습니까?',
          '확인 버튼을 누르면 이동합니다.',
        ).then(({ isConfirmed }) => {
          isConfirmed &&
            instance
              .put(`/chats/${channelId}/user/${myId}`)
              .then(() => nav(`/chats/${channelId}`))
              .catch(() =>
                ErrorAlert('채널 입장 실패', '오류가 발생했습니다.'),
              );
        });
  };

  return (
    <>
      <div className="channel" onClick={handleClick}>
        <h2 className="channelName large">{channelName}</h2>
        {unseenCount === undefined ? (
          ''
        ) : (
          <div className="channelUnseen small">
            <MsgNotificationIcon />
            <p className="channelUnseenCount">
              :{unseenCount > 999 ? '999+' : unseenCount}
            </p>
          </div>
        )}
        <div className="channelMember small">
          <UsersIcon />
          <p className="channelMemberCount">:{memberCount}</p>
        </div>
        <div className="channelAccessMode small">{icon}</div>
      </div>
      {showModal &&
        createPortal(
          <FormModal
            title={'비밀번호를 입력해주세요'}
            form={
              <PasswordForm
                hidden={() => setShowModal(false)}
                channelId={channelId}
                myId={myId}
              />
            }
            hidden={() => setShowModal(false)}
          />,
          document.body,
        )}
    </>
  );
}

export default Channel;
