import { useRecoilState } from 'recoil';
import { ErrorAlert } from '../../util/Alert';
import instance from '../../util/Axios';
import { userRelationship } from '../../util/Recoils';

interface Props {
  userId: number;
}

function FriendButton(props: Props) {
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
      .catch(err => {
        // TODO :400 | 403(차단된 사용자 접근)
        if (err.response.status === 400) {
          ErrorAlert('', '');
        } else if (err.response.status === 403) {
          ErrorAlert('', '');
        }
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
    <>
      {
        {
          friend: (
            <button className="xsmall" onClick={friendDelete}>
              친구 삭제
            </button>
          ),
          blocked: <></>,
          blocker: <></>,
          normal: (
            <button className="xsmall" onClick={friendPut}>
              친구 추가
            </button>
          ),
          pendingSender: (
            <button className="xsmall" onClick={friendDelete}>
              요청 취소
            </button>
          ),
          pendingReceiver: <button className="xsmall">친구 대기</button>,
        }[relationshipMap.get(props.userId)?.relationship ?? 'normal']
      }
    </>
  );
}

export default FriendButton;
