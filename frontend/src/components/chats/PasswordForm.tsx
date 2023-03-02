import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import instance from '../../util/Axios';
import { ErrorAlert, SuccessAlert } from '../../util/Alert';

const PASSWORD_ERR = '비밀번호는 8~16자로 입력해주세요';

interface PasswordFormProps {
  hidden: () => void;
  myId: number;
  channelId: number;
}

function PasswordForm({ hidden, myId, channelId }: PasswordFormProps) {
  const [password, setPassword] = useState<string | undefined>(undefined);
  const [error, setError] = useState<string>('empty');
  const nav = useNavigate();

  const handlePassword = (e: any) => {
    const { value } = e.target;
    if (value.length > 7 && value.length < 17) {
      setPassword(value);
      setError('none');
    } else {
      setError('password');
    }
  };

  const handleSubmit = (e: any) => {
    e.preventDefault();
    error === 'none'
      ? instance
          .put(`/chats/${channelId}/user/${myId}`, {
            password,
          })
          .then(() => {
            SuccessAlert('채널 입장 성공', '채널로 이동합니다').then(() => {
              hidden();
              nav(`/chats/${channelId}`);
            });
          })
          .catch(err => {
            console.log(err);
            ErrorAlert(
              '채널 입장 실패',
              err.response.status === 403
                ? '패스워드가 틀렸을걸?'
                : '뭔가 문제 있단다', // FIXME
            );
          })
      : ErrorAlert('채널 입장 실패', '패스워드를 확인해주세요');
  };

  return (
    <>
      <form className="formModalBody" onSubmit={handleSubmit} id="joinChat">
        <label className="formModalField" htmlFor="password">
          비밀번호
          <input
            type="password"
            name="password"
            onChange={handlePassword}
            autoFocus={true}
          />
        </label>
      </form>
      <div className="formModalButtons">
        <button type="submit" form="joinChat">
          확인
        </button>
        <button onClick={() => hidden()}>취소</button>
      </div>
    </>
  );
}

export default PasswordForm;
