import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import instance from '../../util/Axios';
import '../../style/Modal.css';
import { createPortal } from 'react-dom';
import FormModal from './FormModal';

function CreateForm() {
  const [channelName, setChannelName] = useState<string>('');
  const [accessMode, setAccessMode] = useState<string>('public');
  const [password, setPassword] = useState<string>('');

  const handleChange = (e: any) => {
    const { name, value } = e.target;
    // 각 input 에 대한 validation 필요
    if (name === 'channelName' && value.length <= 20) {
      setChannelName(value);
    } else if (name === 'accessMode') {
      setAccessMode(value);
    } else if (name === 'password') {
      setPassword(value);
    }
  };

  return (
    <form action="put">
      <div>방 이름</div>
      <input
        type="text"
        id="424242"
        name="channelName"
        onChange={handleChange}
      />
      <div>공개 여부</div>
      <select name="accessMode" id="424243" onChange={handleChange}>
        <option value="public">공개</option>
        <option value="protected">공개 (비번)</option>
        <option value="private">비공개(비번)</option>
      </select>
      {accessMode === 'protected' && (
        <div>
          <div>비밀번호</div>
          <input
            type="text"
            id="424244"
            name="password"
            onChange={handleChange}
          />
        </div>
      )}
    </form>
  );
}

function ChannelCreate() {
  const nav = useNavigate();
  const [showModal, setShowModal] = useState<boolean>(false);

  return (
    <>
      <button
        className="chatsNewButton"
        onClick={() => setShowModal(!showModal)}
      >
        Create!
      </button>
      {showModal &&
        createPortal(
          <FormModal
            form={<CreateForm />}
            hidden={() => setShowModal(false)}
          />,
          document.body,
        )}
    </>
  );
}

export default ChannelCreate;
