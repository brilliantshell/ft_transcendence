import { useRecoilState } from 'recoil';
import instance from '../../util/Axios';
import { relationshipState } from '../../util/Recoils';

interface Props {
  userId: number;
}

function FriendButton(props: Props) {
  const [relationship, setRelationship] = useRecoilState(
    relationshipState(props.userId),
  );

  // put (추가 버튼)

  const friendPut = () => {
    instance
      .put(`/user/${props.userId}/friend`)
      .then(() => {
        setRelationship({
          userId: props.userId,
          relationship: 'pendingSender',
        });
      })
      .catch(() => {
        // 400 | 403(차단된 사용자 접근)
      });
  };

  const friendDelete = () => {
    instance.delete(`/user/${props.userId}/friend`).then(() => {
      setRelationship({
        userId: props.userId,
        relationship: 'normal',
      });
    });
  };

  return (
    <>
      {
        {
          friend: <button onClick={friendDelete}>친구 삭제</button>,
          blocked: <></>,
          blocker: <></>,
          normal: <button onClick={friendPut}>친구 추가</button>,
          pendingSender: <button onClick={friendDelete}>요청 취소</button>,
          pendingReceiver: <div>친구 대기</div>,
        }[relationship.relationship]
      }
    </>
  );
}

export default FriendButton;
