import instance from '../../util/Axios';
import UserBase from './UserBase';
import { memo, useEffect } from 'react';
import { useRecoilValue, useSetRecoilState } from 'recoil';
import { myIdState, relationshipState } from '../../util/Recoils';
import { useNavigate } from 'react-router-dom';
import { activityData, relationshipData } from '../hooks/SocketOnHooks';
import BlockButton from './BlockButton';
import FriendButton from './FriendButton';
import GameButton from './GameButton';

/**
- 친구 요청이 왔는지에 대한 소켓이 off

친구 리스트 닫았을 때
- off
- 친구 요청이 왔는지에 대한 소켓이 on
* 
*/

interface Props {
  userId: number;
  activity?: activityData;
  relationship?: relationshipData;
}

function User(props: Props) {
  const myId = useRecoilValue(myIdState);
  const navigate = useNavigate();
  const setRelationship = useSetRecoilState(relationshipState(props.userId));

  const dmOnclick = () => {
    instance
      .put(`/user/${props.userId}/dm`)
      .then(result => {
        navigate(result.headers.location);
      })
      .catch(reason => {
        // 400
        console.error(reason);
      });
  };

  const onlineFunc = () => {
    if (!props.activity || props.activity.activity === 'offline') {
      return false;
    }
    return true;
  };

  useEffect(() => {
    if (props.relationship) {
      setRelationship(props.relationship);
    }
  }, [props.relationship]);

  if (!props.activity || !props.relationship) {
    return <UserBase userId={props.userId} online={false}></UserBase>;
  }

  return (
    <UserBase
      userId={props.userId}
      online={onlineFunc()}
      rightChild={
        <div className="dropdown">
          <img className="dropdownImage" src="/assets/dropdown.svg" />
          <div className="dropdown-content">
            {props.userId === myId ? (
              <div> 본인입니다!!!! </div>
            ) : (
              <>
                <button onClick={dmOnclick}>DM</button>
                <GameButton
                  userId={props.userId}
                  activityData={props.activity}
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
