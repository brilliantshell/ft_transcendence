import { useRecoilState } from 'recoil';
import instance from '../../util/Axios';
import { userRelationship } from '../../util/Recoils';
import { activityData, relationshipData } from '../hooks/SocketOnHooks';
import User from '../User/User';

interface Props {
  userId: number;
  activity?: activityData;
  relationship?: relationshipData;
}

function UserPendingReceivers(props: Props) {
  const [relationshipMap, setRelationshipMap] =
    useRecoilState(userRelationship);
  const friendPut = () => {
    instance
      .put(`/user/${props.userId}/friend`)
      .then(() => {
        setRelationshipMap(prev => {
          const copy = new Map(prev);
          copy.set(props.userId, {
            userId: props.userId,
            relationship: 'pendingSender',
          });
          return copy;
        });
      })
      .catch(() => {
        // 400 | 403(차단된 사용자 접근)
      });
  };

  const friendDelete = () => {
    instance.delete(`/user/${props.userId}/friend`).then(() => {
      setRelationshipMap(prev => {
        const copy = new Map(prev);
        copy.set(props.userId, {
          userId: props.userId,
          relationship: 'normal',
        });
        return copy;
      });
    });
  };

  return (
    <User
      userId={props.userId}
      activity={props.activity}
      relationship={props.relationship}
      downChild={
        <>
          <button>수락</button>
          <button>거절</button>
        </>
      }
    ></User>
  );
}

export default UserPendingReceivers;
