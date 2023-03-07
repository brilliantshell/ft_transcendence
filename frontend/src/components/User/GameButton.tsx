import { useRecoilValue } from 'recoil';
import { relationshipState } from '../../util/Recoils';
import { activityData } from '../hooks/SocketOnHooks';

interface Props {
  userId: number;
  activity: activityData;
}

function GameButton(props: Props) {
  const relationship = useRecoilValue(relationshipState(props.userId));

  const inviteGame = () => {
    // TODO : 게임 초대
    // POST /user/{:userId}/game ⇒ 201 || 400 || 403 || 409
  };

  const watchingGame = () => {
    // TODO : 게임 관전
    // /game/:gameId 로 이동
  };

  if (
    relationship.relationship === 'blocked' ||
    relationship.relationship === 'blocker'
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
