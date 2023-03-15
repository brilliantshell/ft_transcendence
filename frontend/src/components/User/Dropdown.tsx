import BlockButton from './BlockButton';
import FriendButton from './FriendButton';
import GameButton from './GameButton';
import instance from '../../util/Axios';
import { myIdState } from '../../util/Recoils';
import { useNavigate } from 'react-router-dom';
import { useRecoilValue } from 'recoil';

interface Props {
  userId: number;
}

function Dropdown({ userId }: Props) {
  const myId = useRecoilValue(myIdState);
  const navigate = useNavigate();

  const dmOnclick = () => {
    instance
      .put(`/user/${userId}/dm`)
      .then(result => {
        navigate(result.headers.location);
      })
      .catch(() => {});
  };

  return (
    <div className="dropdown">
      <img className="dropdownImage" src="/assets/dropdown.svg" />
      {userId === myId ? (
        <div className="dropdownSelf xsmall">본인입니다!!!!</div>
      ) : (
        <div className="dropdownContent" onClick={e => e.stopPropagation()}>
          <button className="xsmall" onClick={dmOnclick}>
            DM
          </button>
          <GameButton userId={userId} />
          <BlockButton userId={userId} />
          <FriendButton userId={userId} />
        </div>
      )}
    </div>
  );
}

export default Dropdown;
