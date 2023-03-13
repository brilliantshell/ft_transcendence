import { useCallback, useState } from 'react';
import { createPortal } from 'react-dom';
import { ErrorAlert, SuccessAlert } from '../../util/Alert';
import instance from '../../util/Axios';
import SearchModal from '../Search/SearchModal';

interface InvitationButtonProps {
  channelId: string;
}

function ChannelInvitationButton({ channelId }: InvitationButtonProps) {
  const [showModal, setShowModal] = useState<boolean>(false);

  const hideModal = useCallback(() => {
    setShowModal(false);
  }, []);

  const searchAction = useCallback((targetId: number) => {
    instance
      .put(`/chats/${channelId}/user/${targetId}`)
      .then(res => {
        res.status === 204
          ? ErrorAlert(
              '이미 초대된 유저입니다.',
              '유저 닉네임을 다시 확인해주세요.',
            )
          : SuccessAlert('초대 성공!', '즐거운 채팅을 나눠보세요~');
      })
      .catch(err => {
        err.response?.status === 403
          ? ErrorAlert('초대 실패', '채널에서 퇴장 당한 유저입니다.')
          : ErrorAlert('초대 실패', '오류가 발생했습니다.');
      });
    setShowModal(false);
  }, []);

  return (
    <>
      <button onClick={() => setShowModal(true)}>초대</button>
      {showModal &&
        createPortal(
          <SearchModal
            title={'채팅할 친구들을 찾아봐요~~!'}
            actionName={'초대'}
            searchAction={searchAction}
            hideModal={hideModal}
          />,
          document.body,
        )}
    </>
  );
}

export default ChannelInvitationButton;
