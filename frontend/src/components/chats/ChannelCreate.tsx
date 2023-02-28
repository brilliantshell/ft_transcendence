import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import instance from '../../util/Axios';

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
    <div>
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
    </div>
  );
}

function ChannelCreate() {
  const nav = useNavigate();
  const handleClick = () => {
    alert('방 만들기 모달. 성공한다면 넌 방으로 갈거란다');
    instance
      .post('/chats', { channelName: '방이름', accessMode: 'public' })
      .then(res => {
        alert('방 만들기 성공~');
        nav(`/chats/${res.headers.location}`);
      })
      .catch(err => alert(`방 만들기 실패~ ${err.response.status}`));
  };

  return (
    <button className="chatsNewButton" onClick={handleClick}>
      Create!
    </button>
  );
}

export default ChannelCreate;
