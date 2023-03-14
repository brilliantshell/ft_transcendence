import { FileAlert } from '../../util/Alert';
import instance from '../../util/Axios';

function UploadImage() {
  const onClick = () => {
    FileAlert('프로필 사진을 바꿀까요?').then(res => {
      if (res.isConfirmed && res.value) {
        // instance.put(`/profile/image`, { res.value }).then().catch();
        // console.log(res.value);
        console.log('aaaa');
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
