import { useRecoilValue } from 'recoil';
import { userActivity, userRelationship } from '../../util/Recoils';

interface Props {
  userId: number;
}

function GameButton(props: Props) {
  const relationshipMap = useRecoilValue(userRelationship);
  const activityMap = useRecoilValue(userActivity);

  const inviteGame = () => {
    // TODO : 게임 초대
    // POST /user/{:userId}/game ⇒ 201 || 400 || 403 || 409
  };

  const watchingGame = () => {
    // TODO : 게임 관전
    // /game/:gameId 로 이동
  };

  if (
    !relationshipMap.get(props.userId) ||
    relationshipMap.get(props.userId)?.relationship === 'blocked' ||
    relationshipMap.get(props.userId)?.relationship === 'blocker'
  ) {
    return <></>;
  }

  return (
    <>
      {
        {
          offline: <></>,
          online: <button onClick={inviteGame}>게임 초대</button>,
          inGame: <button onClick={watchingGame}>게임 관전</button>,
        }[
          (
            activityMap.get(props.userId) ?? {
              userId: props.userId,
              activity: 'offline',
              gameId: null,
            }
          )?.activity
        ]
      }
    </>
  );
}

export default GameButton;
