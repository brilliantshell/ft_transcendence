import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import instance from '../../util/Axios';
import { ErrorAlert, SuccessAlert } from '../../util/Alert';
import ChannelAccessModeField from '../common/FormModal/ChannelAccessModeField';
import ChannelPasswordField from '../common/FormModal/ChannelPasswordField';

const NAME_ERR = '채널은 1~128자로 입력해주세요';
const PWD_REGEX = /^[a-zA-Z0-9]{8,16}$/;

interface InputErrorInfo {
  name: boolean;
  password: boolean;
}

interface ChannelCreateFormProps {
  hideModal: () => void;
}

function ChannelCreateForm({ hideModal }: ChannelCreateFormProps) {
  const [channelName, setChannelName] = useState<string>('');
  const [accessMode, setAccessMode] = useState<string>('public');
  const [password, setPassword] = useState<string | undefined>(undefined);
  const [error, setError] = useState<InputErrorInfo>({
    name: false,
    password: false,
  });
  const elemRef = useRef<HTMLFormElement>(null);
  const nav = useNavigate();
  const [isEnded, setIsEnded] = useState<boolean>(false);

  const handleName = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (isEnded) {
      return;
    }
    const { value } = e.target;
    setChannelName(value);
    value.length > 0 && value.length < 129
      ? setError({ ...error, name: false })
      : setError({ ...error, name: true });
  };

  const handleAccessMode = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const { value } = e.target;
    setAccessMode(value);
    if (value !== 'protected') {
      setPassword(undefined);
      setError({ ...error, password: false });
    }
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
              hideModal();
              nav(res.headers.location);
            });
          })
          .catch(() => ErrorAlert('채널 생성 실패', '오류가 발생했습니다.'));
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
              onFocus={() => setIsEnded(false)}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  setIsEnded(true);
                  elemRef.current?.children[1].querySelector('select')?.focus();
                }
              }}
            />
            {error.name && (
              <span className="formModalFieldError xsmall">{NAME_ERR}</span>
            )}
          </div>
        </label>
        <ChannelAccessModeField
          autoFocus={false}
          accessMode={accessMode}
          handleAccessMode={handleAccessMode}
        />
        {accessMode === 'protected' && (
          <ChannelPasswordField
            password={password}
            error={error.password}
            handlePassword={handlePassword}
          />
        )}
      </form>
      <div className="formModalButtons">
        <button
          className="formModalConfirm regular"
          type="submit"
          form="createChat"
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

export default ChannelCreateForm;
