import { AxiosError } from 'axios';
import { ErrorAlert } from '../../util/Alert';
import instance from '../../util/Axios';
import { userActivity, userRelationship } from '../../util/Recoils';
import { useNavigate } from 'react-router-dom';
import { useRecoilValue } from 'recoil';

interface Props {
  userId: number;
}

function GameButton({ userId }: Props) {
  const nav = useNavigate();
  const relationshipMap = useRecoilValue(userRelationship);
  const activityMap = useRecoilValue(userActivity);

  const inviteGame = () => {
    instance
      .post(`/user/${userId}/game`)
      .then(({ headers }) => {
        sessionStorage.setItem(
          `game-${headers.location.slice(6)}-isPlayer`,
          'true',
        );
        nav(headers.location);
      })
      .catch((err: AxiosError) =>
        ErrorAlert(
          '게임 초대',
          err.status === 400
            ? '이미 진행 중인 게임이 있습니다.<br/>게임이 끝나면 다시 시도하세요.'
            : '게임 초대에 실패했습니다.',
        ),
      );
  };

  const activityData = activityMap.get(userId);
  const relationship = relationshipMap.get(userId)?.relationship;

  if (
    !activityData ||
    activityData.activity === 'offline' ||
    !relationship ||
    relationship === 'blocked' ||
    relationship === 'blocker'
  ) {
    return <></>;
  }

  const watchingGame = () => {
    const gameId = activityData?.gameId;
    if (!gameId) {
      return;
    }
    sessionStorage.setItem(`game-${gameId}-isPlayer`, 'false');
    nav(`/game/${gameId}`);
  };

  return (
    <>
      {
        {
          online: <button onClick={inviteGame}>게임 초대</button>,
          inGame: <button onClick={watchingGame}>게임 관전</button>,
        }[activityData.activity]
      }
    </>
  );
}

export default GameButton;
