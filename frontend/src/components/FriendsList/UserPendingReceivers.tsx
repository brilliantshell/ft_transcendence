import { ErrorAlert } from '../../util/Alert';
import instance from '../../util/Axios';
import User from '../User/User';
import { useSetRecoilState } from 'recoil';
import { userRelationship } from '../../util/Recoils';

interface Props {
  userId: number;
}

function UserPendingReceivers(props: Props) {
  const setRelationshipMap = useSetRecoilState(userRelationship);
  const friendPatch = () => {
    instance
      .patch(`/user/${props.userId}/friend`)
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
      .catch(err => {
        console.error(err.response.data);
        if (err.response.status === 403) {
          ErrorAlert('차단된 사용자', '차단된 사용자입니다!');
        }
      });
  };

  const friendDelete = () => {
    instance
      .delete(`/user/${props.userId}/friend`)
      .then(() => {
        setRelationshipMap(prev => {
          const copy = new Map(prev);
          copy.set(props.userId, {
            userId: props.userId,
            relationship: 'normal',
          });
          return copy;
        });
      })
      .catch(() => {
        ErrorAlert('오류가 발생', '오류가 발생했습니다!');
      });
  };

  return (
    <User
      userId={props.userId}
      downChild={
        <>
          <button onClick={friendPatch}>수락</button>
          <button onClick={friendDelete}>거절</button>
        </>
      }
    ></User>
  );
}

export default UserPendingReceivers;
