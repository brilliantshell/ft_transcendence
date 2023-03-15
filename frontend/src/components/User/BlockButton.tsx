import { useRecoilState } from 'recoil';
import { ErrorAlert } from '../../util/Alert';
import instance from '../../util/Axios';
import { userRelationship } from '../../util/Recoils';

interface Props {
  userId: number;
}

function BlockButton(props: Props) {
  const [relationshipMap, setRelationshipMap] =
    useRecoilState(userRelationship);
  const blockPut = () => {
    instance
      .put(`/user/${props.userId}/block`)
      .then(() => {
        setRelationshipMap(prev => {
          const copy = new Map(prev);
          copy.set(props.userId, {
            userId: props.userId,
            relationship: 'blocker',
          });
          return copy;
        });
      })
      .catch(err => {
        if (err.response.status === 403) {
          ErrorAlert('차단된 유저입니다.', '넌 아무것도 못해');
        }
      });
  };

  const blockDelete = () => {
    instance
      .delete(`/user/${props.userId}/block`)
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
      .catch(err => {
        if (err.response.status === 403) {
          ErrorAlert('차단된 유저입니다.', '차단을 해제할 수 없습니다.');
        }
      });
  };

  if (relationshipMap.get(props.userId)?.relationship === 'blocker') {
    return (
      <button className="xsmall" onClick={blockDelete}>
        차단 해제
      </button>
    );
  } else if (relationshipMap.get(props.userId)?.relationship === 'blocked') {
    return <></>;
  }
  return (
    <button className="xsmall" onClick={blockPut}>
      차단
    </button>
  );
}

export default BlockButton;
