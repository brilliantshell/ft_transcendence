import { useSetRecoilState } from 'recoil';
import { ConfirmAlert } from '../../util/Alert';
import instance from '../../util/Axios';
import { editProfileState } from '../../util/Recoils';

function DeleteImage() {
  const setEditProfile = useSetRecoilState(editProfileState);
  const onClick = () => {
    ConfirmAlert('프로필 사진을 지울까요?', '기본 이미지가 들어갑니다.').then(
      res => {
        if (res.isConfirmed) {
          instance.delete(`/profile/image`).then(() => {
            setEditProfile(editProfile => !editProfile);
          });
        }
      },
    );
  };

  return (
    <button className="menuButton deleteProfileImageButton" onClick={onClick}>
      <span className="menuTooltip">Delete Image</span>
    </button>
  );
}

export default DeleteImage;
