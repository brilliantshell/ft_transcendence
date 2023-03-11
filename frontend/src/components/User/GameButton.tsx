import { AxiosError } from 'axios';
import { ErrorAlert } from '../../util/Alert';
import { activityData } from '../hooks/SocketOnHooks';
import instance from '../../util/Axios';
import { relationshipState } from '../../util/Recoils';
import { useNavigate } from 'react-router-dom';
import { useRecoilValue } from 'recoil';

interface Props {
  userId: number;
  activityData: activityData;
}

function GameButton({ userId, activityData }: Props) {
  const { relationship } = useRecoilValue(relationshipState(userId));
  const { activity, gameId } = activityData;
  const nav = useNavigate();

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

  const watchingGame = () => {
    sessionStorage.setItem(`game-${gameId}-isPlayer`, 'false');
    nav(`/game/${gameId}`);
  };

  if (relationship === 'blocked' || relationship === 'blocker') {
    return <></>;
  }

  return (
    <>
      {
        {
          offline: <></>,
          online: <button onClick={inviteGame}>게임 초대</button>,
          inGame: <button onClick={watchingGame}>게임 관전</button>,
        }[activity]
      }
    </>
  );
}

export default GameButton;
