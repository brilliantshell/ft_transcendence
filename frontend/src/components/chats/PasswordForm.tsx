import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import instance from '../../util/Axios';
import { ErrorAlert, SuccessAlert } from '../../util/Alert';
import { AxiosError } from 'axios';

const PWD_REGEX = /^[a-zA-Z0-9]{8,16}$/;
const PWD_ERR = '비밀번호는 8~16자로 입력해주세요';

interface PasswordFormProps {
  hideModal: () => void;
  myId: number;
  channelId: number;
}

function PasswordForm({ hideModal, myId, channelId }: PasswordFormProps) {
  const [password, setPassword] = useState<string | undefined>(undefined);
  const [error, setError] = useState<boolean>(false);
  const nav = useNavigate();

  const handlePassword = (e: any) => {
    const { value } = e.target;
    setPassword(value);
    PWD_REGEX.test(value) ? setError(false) : setError(true);
  };

  const handleSubmit = (e: any) => {
    e.preventDefault();
    error
      ? ErrorAlert('채널 입장 실패', '비밀번호를 확인해주세요.')
      : instance
          .put(`/chats/${channelId}/user/${myId}`, {
            password,
          })
          .then(() => {
            SuccessAlert('채널 입장 성공', '채널로 이동합니다.').then(() => {
              hideModal();
              nav(`/chats/${channelId}`);
            });
          })
          .catch(err => {
            const message =
              err.response?.status !== 403
                ? '오류가 발생했습니다.'
                : err.response.data.message === 'Password is incorrect'
                ? '비밀번호가 틀렸습니다.'
                : '해당 채널에 입장할 수 없습니다.';
            ErrorAlert('채널 입장 실패', message);
          });
  };

  return (
    <>
      <form className="formModalBody" onSubmit={handleSubmit} id="joinChat">
        <label className="formModalField" htmlFor="password">
          <div className="formModalFieldName">비밀번호</div>
          <div className="formModalFieldValue">
            <input
              className="formModalFieldInput"
              type="password"
              name="password"
              autoFocus={true}
              value={password}
              onChange={handlePassword}
            />
            {error && (
              <span className="formModalFieldError xsmall"> {PWD_ERR} </span>
            )}
          </div>
        </label>
      </form>
      <div className="formModalButtons">
        <button
          className="formModalConfirm regular"
          type="submit"
          form="createChat"
          onClick={handleSubmit}
        >
          확인
        </button>
        <button className="formModalCancel regular" onClick={hideModal}>
          취소
        </button>
      </div>
    </>
  );
}

export default PasswordForm;
