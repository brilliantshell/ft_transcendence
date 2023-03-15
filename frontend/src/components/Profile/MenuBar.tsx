import ChangeNickname from './ChangeNickname';
import DeleteImage from './DeleteImage';
import UploadImage from './UploadImage';
import TwoFASetting from './TwoFASetting';

function MenuBarWrapper() {
  return (
    <div className="profileItem menuBar">
      <ChangeNickname />
      <UploadImage />
      <DeleteImage />
      <TwoFASetting />
    </div>
  );
}

function ProfileMenuBar(props: { userId: number | null }) {
  return (
    (props.userId && <MenuBarWrapper />) || (
      <div className="profileItem">Another User's Profile</div>
    )
  );
}

export default ProfileMenuBar;
