import BlockButton from './BlockButton';
import { ErrorAlert } from '../../util/Alert';
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
      .catch(err => {
        if (err.response.status === 400) {
          ErrorAlert('DM을 보낼 수 없습니다.', err.response.data.message);
        }
      });
  };

  return (
    <div className="dropdown">
      <img className="dropdownImage" src="/assets/dropdown.svg" />
      <div className="dropdown-content" onClick={e => e.stopPropagation()}>
        {userId === myId ? (
          <div> 본인입니다!!!! </div>
        ) : (
          <>
            <button onClick={dmOnclick}>DM</button>
            <GameButton userId={userId} />
            <BlockButton userId={userId} />
            <FriendButton userId={userId} />
          </>
        )}
      </div>
    </div>
  );
}

export default Dropdown;
