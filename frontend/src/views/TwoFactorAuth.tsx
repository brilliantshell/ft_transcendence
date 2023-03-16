import { InfoAlert } from '../util/Alert';
import axios from 'axios';
import { useState } from 'react';

export default function TwoFactorAuth() {
  const [authCode, setAuthCode] = useState<string>('');
  return (
    <div className="twoFA">
      <h1 className="twoFAHeading xxlarge">Two-Factor</h1>
      <h1 className="twoFAHeading xxlarge">Authentication</h1>
      <input
        className="twoFAInput xlarge"
        autoFocus={true}
        autoComplete="off"
        onChange={e => setAuthCode(e.target.value)}
        placeholder="인증 코드"
      />
      <button
        className="twoFASubmitButton"
        type="button"
        onClick={() => {
          axios
            .post('/api/login/2fa', { authCode })
            .then(() => (window.location.href = '/'))
            .catch(error => {
              const { status } = error.response;
              InfoAlert(
                '인증 실패',
                status === 404
                  ? '인증 코드가 만료되었습니다. 다시 시도하세요.'
                  : '인증 코드를 확인하고 다시 시도해주세요.',
              ).then(() => {
                if (error.response.status === 404) {
                  window.location.href = '/login';
                }
              });
            });
        }}
      >
        SUBMIT
      </button>
    </div>
  );
}
