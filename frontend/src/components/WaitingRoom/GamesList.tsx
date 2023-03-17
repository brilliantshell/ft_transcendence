import { ErrorAlert } from '../../util/Alert';
import GameInProgressButton from './GameInProgressButton';
import instance from '../../util/Axios';
import { socket } from '../../util/Socket';
import { useEffect } from 'react';
import { useRecoilState } from 'recoil';
import { gamesInProgressState } from '../../util/Recoils';

export default function GamesList() {
  const [games, setGamesInProgress] = useRecoilState(gamesInProgressState);

  const gameStartedListener = ({ id, left, right }: GameStartedMessage) =>
    setGamesInProgress(gamesInProgress => [
      { id, left, right },
      ...gamesInProgress,
    ]);

  const gameEndedListener = ({ id: endedId }: GameEndedMessage) =>
    setGamesInProgress(gamesInProgress =>
      gamesInProgress.filter(({ id }) => id !== endedId),
    );

  useEffect(() => {
    socket.on('gameStarted', gameStartedListener);
    socket.on('gameEnded', gameEndedListener);
    instance
      .get('/game/list')
      .then(({ data }) => setGamesInProgress(data.games))
      .catch(() => {
        ErrorAlert(
          '진행 중인 게임 목록',
          '진행 중인 게임 목록을 불러오는데 실패했습니다<br/>다시 시도해주세요',
        );
      });
    return () => {
      socket.off('gameStarted');
      socket.off('gameEnded');
    };
  }, []);

  return (
    <div className="gamesList">
      {games.length ? (
        games.map(({ id, left, right }) => {
          return (
            <div key={id} className="gameWrapper">
              <GameInProgressButton
                gameId={id}
                leftNickname={left}
                rightNickname={right}
              />
            </div>
          );
        })
      ) : (
        <div className="noGamesInProgress xlarge">
          진행 중인 게임이 없습니다
        </div>
      )}
    </div>
  );
}

// SECTION : Interfaces

interface GameStartedMessage {
  id: string;
  left: string;
  right: string;
}

interface GameEndedMessage {
  id: string;
}
