import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import instance from '../../util/Axios';

interface Props {
  myId: number;
  channelId: number;
  hidden: () => void;
}
function PasswordForm({ myId, channelId, hidden }: Props) {
  const [password, setPassword] = useState<string | undefined>(undefined);
  const nav = useNavigate();

  const handlePassword = (e: any) => {
    setPassword(e.target.value);
  };

  const handleSubmit = (e: any) => {
    e.preventDefault();
    instance
      .put(`/chats/${channelId}/user/${myId}`, {
        password,
      })
      .then(() => nav(`/chats/${channelId}`))
      .catch(err => alert(`히히 못들어가! ${err.response.status}`));
  };

  return (
    <>
      <form className="formModalBody" onSubmit={handleSubmit} id="joinChat">
        <label htmlFor="password">
          비밀번호
          <input
            type="password"
            name="password"
            onChange={handlePassword}
            autoFocus={true}
          />
        </label>
      </form>
      <div>
        <button type="submit" form="joinChat">
          확인
        </button>
        <button
          onClick={() => {
            hidden();
          }}
        >
          취소
        </button>
      </div>
    </>
  );
}

export default PasswordForm;
