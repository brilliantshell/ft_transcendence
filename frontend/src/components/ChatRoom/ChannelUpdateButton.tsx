import { useState } from 'react';
import { createPortal } from 'react-dom';
import FormModal from '../common/FormModal/FormModal';
import ChannelUpdateForm from './ChannelUpdateForm';

interface ChannelUpdateButtonProp {
  channelId: string;
}

function ChannelUpdateButton({ channelId }: ChannelUpdateButtonProp) {
  const [showModal, setShowModal] = useState<boolean>(false);

  const hideModal = () => setShowModal(false);

  return (
    <>
      <button onClick={() => setShowModal(true)}>수정</button>
      {showModal &&
        createPortal(
          <FormModal
            title={'채널 정보 수정'}
            form={
              <ChannelUpdateForm channelId={channelId} hideModal={hideModal} />
            }
            hideModal={hideModal}
          />,
          document.body,
        )}
    </>
  );
}

export default ChannelUpdateButton;
