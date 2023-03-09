import { useRecoilValue } from 'recoil';
import { userRelationship } from '../../util/Recoils';

import { activityData } from '../hooks/SocketOnHooks';

interface Props {
  userId: number;
  activity: activityData;
}

function GameButton(props: Props) {
  const relationshipMap = useRecoilValue(userRelationship);

  const inviteGame = () => {
    // TODO : 게임 초대
    // POST /user/{:userId}/game ⇒ 201 || 400 || 403 || 409
  };

  const watchingGame = () => {
    // TODO : 게임 관전
    // /game/:gameId 로 이동
  };

  if (
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
        }[props.activity.activity]
      }
    </>
  );
}

export default GameButton;
