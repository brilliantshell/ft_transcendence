import '../../style/Profile/MenuBar.css';

function MenuBarWrapper() {
  return (
    <div className="profileItem">
      <ul className="menuBar">
        <li className="menuButton profile">
          <span className="menuTooltip">Edit Profile</span>
        </li>
        <li className="menuButton twoFA">
          <span className="menuTooltip">2FA Setting</span>
        </li>
        <li className="menuButton etc">
          <span className="menuTooltip">etc</span>
        </li>
      </ul>
    </div>
  );
}

function ProfileMenuBar(props: { userId: number | null }) {
  return (
    (props.userId && <MenuBarWrapper />) || (
      /* TODO - 다른 유저의 프로필 조회시 메뉴 바 대신 표시될 부분 더 예쁘게 수정 */
      <div className="profileItem">Another User's Profile</div>
    )
  );
}

export default ProfileMenuBar;
