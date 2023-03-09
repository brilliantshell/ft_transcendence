import instance from '../../util/Axios';
import UserBase from './UserBase';
import { memo, ReactNode } from 'react';
import { useRecoilValue } from 'recoil';
import { myIdState } from '../../util/Recoils';
import { useNavigate } from 'react-router-dom';
import { activityData, relationshipData } from '../hooks/SocketOnHooks';
import BlockButton from './BlockButton';
import FriendButton from './FriendButton';
import GameButton from './GameButton';
import { ErrorAlert } from '../../util/Alert';

interface Props {
  userId: number;
  session?: boolean;
  activity?: activityData;
  relationship?: relationshipData;
  downChild?: ReactNode;
}

function User(props: Props) {
  const myId = useRecoilValue(myIdState);
  const navigate = useNavigate();

  const dmOnclick = () => {
    instance
      .put(`/user/${props.userId}/dm`)
      .then(result => {
        navigate(result.headers.location);
      })
      .catch(err => {
        if (err.response.status === 400) {
          ErrorAlert('DM을 보낼 수 없습니다.', err.response.data.message);
        }
      });
  };

  const onlineFunc = () => {
    if (!props.activity) return false;
    return props.activity.activity !== 'offline';
  };

  if (!props.activity || !props.relationship) {
    return (
      <UserBase
        userId={props.userId}
        online={false}
        downChild={props.downChild}
        session={props.session}
      ></UserBase>
    );
  }

  return (
    <UserBase
      userId={props.userId}
      online={onlineFunc()}
      downChild={props.downChild}
      session={props.session}
      rightChild={
        <div className="dropdown">
          <img className="dropdownImage" src="/assets/dropdown.svg" />
          <div className="dropdown-content" onClick={e => e.stopPropagation()}>
            {props.userId === myId ? (
              <div> 본인입니다!!!! </div>
            ) : (
              <>
                <button onClick={dmOnclick}>DM</button>
                <GameButton
                  userId={props.userId}
                  activity={props.activity}
                ></GameButton>
                <BlockButton userId={props.userId} />
                <FriendButton userId={props.userId}></FriendButton>
              </>
            )}
          </div>
        </div>
      }
    />
  );
}

export default memo(User);
