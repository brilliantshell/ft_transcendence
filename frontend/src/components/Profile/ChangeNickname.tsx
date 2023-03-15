import { ErrorAlert, InputAlert } from '../../util/Alert';
import instance from '../../util/Axios';

function ChangeNickname() {
  const onClick = () => {
    InputAlert('닉네임 변경!', '4글자 이상 10글자 이내').then(res => {
      if (!res.value) return;
      instance
        .patch(`/profile/nickname`, { nickname: res.value })
        .then(res => {
          console.log(res);
        })
        .catch(err => {
          if (err.response.status === 409) {
            ErrorAlert('닉네임 변경 오류', '닉네임이 이미 존재합니다.');
          } else if (err.response.status === 400) {
            ErrorAlert('닉네임 변경 오류', '4글자 이상 10글자 이내입니다.');
          }
        });
    });
  };

  return (
    <button className="menuButton changeNicknameButton" onClick={onClick}>
      <span className="menuTooltip">Change Nickname</span>
    </button>
  );
}

export default ChangeNickname;
