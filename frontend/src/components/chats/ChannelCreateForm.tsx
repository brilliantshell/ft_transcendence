import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import instance from '../../util/Axios';

interface Props {
  hidden: () => void;
}

function ChannelCreateForm({ hidden }: Props) {
  const [channelName, setChannelName] = useState<string>('');
  const [accessMode, setAccessMode] = useState<string>('public');
  const [password, setPassword] = useState<string | undefined>(undefined);
  const [error, setError] = useState<string>('');
  const elemRef = useRef<HTMLFormElement>(null);
  const nav = useNavigate();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { value } = e.target;
    // 각 input 에 대한 validation 필요
    if (value.length > 0 || value.length < 129) {
      setChannelName(value);
    } else {
      setError('채널 이름은 1~128자로 입력해주세요');
    }
  };

  const handlePassword = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { value } = e.target;
    if (value.length > 7 || value.length < 17 || value) {
      setPassword(value);
    } else {
      setError('비밀번호는 8~16자로 입력해주세요');
    }
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    instance
      .post('/chats', {
        channelName,
        accessMode,
        password,
      })
      .then(res => {
        alert('채널 생성 성공');
        return nav(res.headers.location);
      })
      .catch(err => {
        alert(`채널 생성 실패 ${err.response.status}`);
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
          채널 이름
          <input
            type="text"
            name="channelName"
            onChange={handleChange}
            value={channelName}
            autoFocus={true}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                e.preventDefault();
                elemRef.current?.children[1].querySelector('select')?.focus();
              }
            }}
          />
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
            </label>
          </>
        )}
      </form>
      <div>
        <button type="submit" form="createChat">
          확인
        </button>
        <button onClick={hidden}>취소</button>
      </div>
    </>
  );
}

export default ChannelCreateForm;
