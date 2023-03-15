import { useEffect, useState } from 'react';
import {
  ConfirmAlert,
  EmailAlert,
  ErrorAlert,
  InputAlert,
} from '../../util/Alert';
import instance from '../../util/Axios';

function TwoFASetting() {
  const [email, setEmail] = useState<string | null>(null);

  const onClickSetting = () => {
    const str = email
      ? `현재 이메일은 ${email} 입니다.`
      : '등록된 메일이 없습니다.';
    EmailAlert(str).then(res1 => {
      instance
        .patch('/profile/2fa-email', { email: res1.value })
        .then(() => {
          InputAlert('인증번호를 보냈습니다.', '인증번호를 입력해주세요.').then(
            res2 => {
              if (res2.isConfirmed) {
                instance
                  .post('/profile/2fa-email/verification', {
                    authCode: res2.value,
                  })
                  .then(() => {
                    setEmail(res1.value);
                  })
                  .catch(err => {
                    if (err.response.status === 403) {
                      ErrorAlert(
                        '인증번호가 틀렸습니다.',
                        '다시 시도해주세요.',
                      );
                    }
                  });
              }
            },
          );
        })
        .catch(err => {
          if (err.response.status === 409) {
            ErrorAlert(
              '이미 등록된 이메일입니다.',
              '다른 이메일을 입력해주세요.',
            );
          }
        });
    });
  };

  const onClickDelete = () => {
    ConfirmAlert(
      '2FA를 삭제하시겠습니까?',
      '보안이 취약해질 수 있습니다.',
    ).then(res => {
      if (res.isConfirmed) {
        instance
          .delete('/profile/2fa-email')
          .then(() => {
            setEmail(null);
          })
          .catch(() => {
            ErrorAlert('2FA 삭제에 실패했습니다.', '다시 시도해주세요.');
          });
      }
    });
  };

  useEffect(() => {
    instance
      .get('/profile/2fa-email')
      .then(res => {
        setEmail(res.data.email);
      })
      .catch(() => {});
  }, []);

  return (
    <>
      <button className="menuButton setTwoFAButton" onClick={onClickSetting}>
        <span className="menuTooltip">2FA Setting</span>
      </button>
      {email && (
        <button
          className="menuButton deleteTwoFAButton"
          onClick={onClickDelete}
        >
          <span className="menuTooltip">2FA Delete</span>
        </button>
      )}
    </>
  );
}
export default TwoFASetting;
