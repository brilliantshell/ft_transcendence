import { useSetRecoilState } from 'recoil';
import { ErrorAlert, FileAlert } from '../../util/Alert';
import instance from '../../util/Axios';
import { editProfileState } from '../../util/Recoils';

function UploadImage() {
  const setEditProfile = useSetRecoilState(editProfileState);
  const onClick = () => {
    FileAlert('프로필 사진을 바꿀까요?').then(res => {
      if (res.isConfirmed && res.value) {
        const formData = new FormData();
        formData.append('profileImage', res.value);
        instance
          .put(`/profile/image`, formData)
          .then(() => {
            setEditProfile(editProfile => !editProfile);
          })
          .catch(err => {
            if (err.response.status === 413) {
              ErrorAlert('파일이 너무 큽니다.', '4MB 이하로 해 주세요.');
            }
          });
      }
    });
  };
  return (
    <button className="menuButton uploadProfileImageButton" onClick={onClick}>
      <span className="menuTooltip">Upload Image</span>
    </button>
  );
}

export default UploadImage;
