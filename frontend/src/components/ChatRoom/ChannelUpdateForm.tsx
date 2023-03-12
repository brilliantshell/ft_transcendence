import { useRef, useState } from 'react';
import instance from '../../util/Axios';
import { ErrorAlert, SuccessAlert } from '../../util/Alert';
import ChannelAccessModeField from '../common/FormModal/ChannelAccessModeField';
import ChannelPasswordField from '../common/FormModal/ChannelPasswordField';

const PWD_REGEX = /^[a-zA-Z0-9]{8,16}$/;

interface ChannelUpdateFormProp {
  channelId: string;
  hideModal: () => void;
}

function ChannelUpdateForm({ channelId, hideModal }: ChannelUpdateFormProp) {
  const [accessMode, setAccessMode] = useState<string>('public');
  const [password, setPassword] = useState<string | undefined>(undefined);
  const [error, setError] = useState<boolean>(false);
  const elemRef = useRef<HTMLFormElement>(null);

  const handlePassword = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { value } = e.target;
    setPassword(value);
    PWD_REGEX.test(value) ? setError(false) : setError(true);
  };

  const handleAccessMode = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const { value } = e.target;
    setAccessMode(value);
    if (value !== 'protected') {
      setPassword(undefined);
      setError(false);
    }
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const accessModeMsg =
      accessMode === 'public'
        ? '공개'
        : accessMode === 'protected'
        ? '공개 (비밀번호)'
        : '비공개';

    error
      ? ErrorAlert('채널 정보 변경 실패', '입력값을 확인해주세요.')
      : instance
          .patch(`/chats/${channelId}`, {
            accessMode,
            password,
          })
          .then(() => {
            SuccessAlert(
              '채널 정보 변경 성공',
              `${accessModeMsg} 채널로 변경되었습니다.`,
            ).then(() => hideModal());
          })
          .catch(() =>
            ErrorAlert('채널 정보 변경 실패', '오류가 발생했습니다.').then(() =>
              hideModal(),
            ),
          );
  };

  return (
    <>
      <form
        className="formModalBody"
        onSubmit={handleSubmit}
        id="updateChat"
        ref={elemRef}
      >
        <ChannelAccessModeField
          autoFocus={true}
          accessMode={accessMode}
          handleAccessMode={handleAccessMode}
        />
        {accessMode === 'protected' && (
          <ChannelPasswordField
            password={password}
            error={error}
            handlePassword={handlePassword}
          />
        )}
      </form>
      <div className="formModalButtons">
        <button
          className="formModalConfirm regular"
          type="submit"
          form="updateChat"
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

export default ChannelUpdateForm;
