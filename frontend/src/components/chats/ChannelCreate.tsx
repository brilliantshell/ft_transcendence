import { useState } from 'react';

import { createPortal } from 'react-dom';
import FormModal from './FormModal';
import ChannelCreateForm from './ChannelCreateForm';
import '../../style/FormModal.css';

function ChannelCreate() {
  const [showModal, setShowModal] = useState<boolean>(false);

  return (
    <>
      <button className="chatsNewButton" onClick={() => setShowModal(true)}>
        Create!
      </button>
      {showModal &&
        createPortal(
          <FormModal
            title={'방을 만들어 보아요~'}
            form={<ChannelCreateForm hidden={() => setShowModal(false)} />}
            hidden={() => setShowModal(false)}
          />,
          document.body,
        )}
    </>
  );
}

export default ChannelCreate;