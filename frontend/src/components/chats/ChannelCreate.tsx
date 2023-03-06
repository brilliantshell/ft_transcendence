import { useState } from 'react';

import { createPortal } from 'react-dom';
import FormModal from './FormModal';
import ChannelCreateForm from './ChannelCreateForm';
import '../../style/FormModal.css';

function ChannelCreate() {
  const [showModal, setShowModal] = useState<boolean>(false);

  return (
    <>
      <button className="chatsNewButton xxlarge textBold" onClick={() => setShowModal(true)}>
        +
      </button>
      {showModal &&
        createPortal(
          <FormModal
            title={'채팅방 생성'}
            form={<ChannelCreateForm hidden={() => setShowModal(false)} />}
            hidden={() => setShowModal(false)}
          />,
          document.body,
        )}
    </>
  );
}

export default ChannelCreate;
