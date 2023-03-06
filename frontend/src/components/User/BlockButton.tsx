import { useRecoilState } from 'recoil';
import instance from '../../util/Axios';
import { relationshipState } from '../../util/Recoils';

interface Props {
  userId: number;
}

function BlockButton(props: Props) {
  const [relationship, setRelationship] = useRecoilState(
    relationshipState(props.userId),
  );

  const blockPut = () => {
    instance
      .put(`/user/${props.userId}/block`)
      .then(() => {
        setRelationship({
          userId: props.userId,
          relationship: 'blocker',
        });
      })
      .catch(reason => {
        // 403
        console.error(reason);
      });
  };

  const blockDelete = () => {
    instance
      .delete(`/user/${props.userId}/block`)
      .then(() => {
        setRelationship({
          userId: props.userId,
          relationship: 'normal',
        });
      })
      .catch(reason => {
        // 403
        console.error(reason);
      });
  };

  if (relationship.relationship === 'blocker') {
    return <button onClick={blockDelete}>차단 해제</button>;
  } else if (relationship.relationship === 'blocked') {
    return <></>;
  }
  return <button onClick={blockPut}>차단</button>;
}

export default BlockButton;
