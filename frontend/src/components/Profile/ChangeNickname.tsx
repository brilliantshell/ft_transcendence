import { useSetRecoilState } from 'recoil';
import { ErrorAlert, InputAlert } from '../../util/Alert';
import instance from '../../util/Axios';
import { editProfileState } from '../../util/Recoils';

function ChangeNickname() {
  const setEditProfile = useSetRecoilState(editProfileState);

  const onClick = () => {
    InputAlert('닉네임 변경!', '영문 4 ~ 10글자 이내').then(res => {
      if (!res.value) return;
      if (!/^[a-zA-Z]{4,10}$/.test(res.value)) {
        ErrorAlert('닉네임 변경 오류', '닉네임은 영문 4 ~ 10글자입니다.');
        return;
      }
      instance
        .patch(`/profile/nickname`, { nickname: res.value })
        .then(() => {
          setEditProfile(editProfile => !editProfile);
        })
        .catch(err => {
          if (err.response.status === 409) {
            ErrorAlert('닉네임 변경 오류', '닉네임이 이미 존재합니다.');
          } else if (err.response.status === 400) {
            ErrorAlert('닉네임 변경 오류', '닉네임은 영문 4 ~ 10글자입니다.');
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
