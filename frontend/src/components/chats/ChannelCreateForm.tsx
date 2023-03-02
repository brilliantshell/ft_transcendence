import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import instance from '../../util/Axios';
import { ErrorAlert, SuccessAlert } from '../../util/Alert';

const NAME_ERR = '채널 이름은 1~128자로 입력해주세요';
const PASSWORD_ERR = '비밀번호는 8~16자로 입력해주세요';
type InputErrorInfo = 'name' | 'password' | 'none';

interface ChannelCreateFormProps {
  hidden: () => void;
}



const isAlphanumeric = (str: string) => {
  const reg = /^[a-zA-Z0-9]*$/;
  return reg.test(str);
};

function ChannelCreateForm({ hidden }: ChannelCreateFormProps) {
  const [channelName, setChannelName] = useState<string>('');
  const [accessMode, setAccessMode] = useState<string>('public');
  const [password, setPassword] = useState<string | undefined>(undefined);
  const [error, setError] = useState<InputErrorInfo>('name');
  const elemRef = useRef<HTMLFormElement>(null);
  const nav = useNavigate();

  const handleName = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { value } = e.target;
    if (value.length > 0 && value.length < 129) {
      setChannelName(value);
      setError('none');
    } else {
      setError('name');
    }
  };

  const handlePassword = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { value } = e.target;
    if (value.length > 7 && value.length < 17) {
      setPassword(value);
    } else {
      setError('password');
    }
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    error === 'none'
      ? instance
          .post('/chats', {
            channelName,
            accessMode,
            password,
          })
          .then(res => {
            SuccessAlert('채널 생성 성공', '채널로 이동합니다').then(() => {
              hidden();
              nav(res.headers.location);
            });
          })
          .catch(err => {
            console.log(err);
            ErrorAlert('채널 생성 실패', err.message); //FIXME : 에러 메시지 변경
          })
      : ErrorAlert('채널 생성 실패', '입력값을 확인해주세요'); // FIXME : 에러 메시지 변경
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
          채널 이름
          <input
            type="text"
            name="channelName"
            onChange={handleName}
            autoFocus={true}
            autoComplete="off"
            onKeyDown={e => {
              if (e.key === 'Enter') {
                e.preventDefault();
                elemRef.current?.children[1].querySelector('select')?.focus();
              }
            }}
          />
          {error === 'name' && <span className="xxsmall">{NAME_ERR}</span>}
        </label>
        <label className="formModalField" htmlFor="accessMode">
          공개 범위
          <select
            name="accessMode"
            onChange={e => setAccessMode(e.target.value)}
          >
            <option value="public">공개</option>
            <option value="protected">공개 (비밀번호)</option>
            <option value="private">비공개</option>
          </select>
        </label>
        {accessMode === 'protected' && (
          <>
            <label className="formModalField" htmlFor="password">
              비밀번호
              <input
                type="password"
                name="password"
                onChange={handlePassword}
                autoFocus={true}
              />
              {error === 'password' && (
                <span className="xxsmall">{PASSWORD_ERR}</span>
              )}
            </label>
          </>
        )}
      </form>
      <div className="formModalButtons">
        <button type="submit" form="createChat">
          확인
        </button>
        <button onClick={hidden}>취소</button>
      </div>
    </>
  );
}

export default ChannelCreateForm;
