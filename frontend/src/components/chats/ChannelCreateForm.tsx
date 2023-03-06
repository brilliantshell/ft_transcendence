import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import instance from '../../util/Axios';
import { ConfirmAlert, ErrorAlert, SuccessAlert } from '../../util/Alert';

const NAME_ERR = '채널은 1~128자로 입력해주세요';
const PWD_ERR = '비밀번호는 8~16자로 입력해주세요';
const PWD_REGEX = /^[a-zA-Z0-9]{8,16}$/;

interface InputErrorInfo {
  name: boolean;
  password: boolean;
}

interface ChannelCreateFormProps {
  hidden: () => void;
}

function ChannelCreateForm({ hidden }: ChannelCreateFormProps) {
  const [channelName, setChannelName] = useState<string>('');
  const [accessMode, setAccessMode] = useState<string>('public');
  const [password, setPassword] = useState<string | undefined>(undefined);
  const [error, setError] = useState<InputErrorInfo>({
    name: false,
    password: false,
  });
  const elemRef = useRef<HTMLFormElement>(null);
  const nav = useNavigate();

  const handleName = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { value } = e.target;
    setChannelName(value);
    value.length > 0 && value.length < 129
      ? setError({ ...error, name: false })
      : setError({ ...error, name: true });
  };

  const handlePassword = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { value } = e.target;
    setPassword(value);
    PWD_REGEX.test(value)
      ? setError({ ...error, password: false })
      : setError({ ...error, password: true });
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    error.name || error.password
      ? ErrorAlert('채널 생성 실패', '입력값을 확인해주세요.')
      : instance
          .post('/chats', {
            channelName,
            accessMode,
            password,
          })
          .then(res => {
            SuccessAlert('채널 생성 성공', '채널로 이동합니다.').then(() => {
              hidden();
              nav(res.headers.location);
            });
          })
          .catch(err => {
            ErrorAlert('채널 생성 실패', '오류가 발생했습니다.'); //FIXME : 에러 메시지 변경
          });
  };

  return (
    <>
      <form
        className="formModalBody"
        onSubmit={handleSubmit}
        id="createChat"
        ref={elemRef}
      >
        <label className="formModalField" htmlFor="channelName">
          <p className="formModalFieldName"> 채널 이름</p>
          <div className="formModalFieldValue">
            <input
              className="formModalFieldInput"
              type="text"
              name="channelName"
              autoFocus={true}
              autoComplete="off"
              value={channelName}
              onChange={handleName}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  elemRef.current?.children[1].querySelector('select')?.focus();
                }
              }}
            />
            {error.name && (
              <span className="formModalFieldError xsmall">{NAME_ERR}</span>
            )}
          </div>
        </label>
        <label className="formModalField" htmlFor="accessMode">
          <p className="formModalFieldName">공개 범위</p>
          <div className="formModalFieldValue">
            <select
              className="formModalFieldInput"
              name="accessMode"
              onChange={e => setAccessMode(e.target.value)}
            >
              <option value="public">공개</option>
              <option value="protected">공개 (비밀번호)</option>
              <option value="private">비공개</option>
            </select>
          </div>
        </label>
        {accessMode === 'protected' && (
          <label className="formModalField" htmlFor="password">
            <p className="formModalFieldName">비밀번호</p>
            <div className="formModalFieldValue">
              <input
                className="formModalFieldInput"
                type="password"
                name="password"
                autoFocus={true}
                value={password}
                onChange={handlePassword}
              />
              {error.password && (
                <span className="formModalFieldError xsmall"> {PWD_ERR} </span>
              )}
            </div>
          </label>
        )}
      </form>
      <div className="formModalButtons">
        <button className='formModalConfirm regular' type="submit" form="createChat">
          확인
        </button>
        <button className='formModalCancel regular' onClick={hidden}>취소</button>
      </div>
    </>
  );
}

export default ChannelCreateForm;
