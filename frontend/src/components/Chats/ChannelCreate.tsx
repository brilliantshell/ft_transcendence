import { useState } from 'react';
import { createPortal } from 'react-dom';
import FormModal from '../common/FormModal/FormModal';
import ChannelCreateForm from './ChannelCreateForm';

function ChannelCreate() {
  const [showModal, setShowModal] = useState<boolean>(false);

  const hideModal = () => setShowModal(false);

  return (
    <>
      <button
        className="chatsNewButton xxlarge textBold"
        onClick={() => setShowModal(true)}
      >
        +
      </button>
      {showModal &&
        createPortal(
          <FormModal
            title={'채팅방 생성'}
            form={<ChannelCreateForm hideModal={hideModal} />}
            hideModal={hideModal}
          />,
          document.body,
        )}
    </>
  );
}

export default ChannelCreate;
