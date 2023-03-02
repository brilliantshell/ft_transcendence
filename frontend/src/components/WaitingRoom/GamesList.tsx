import { ErrorAlert } from '../../util/Alert';
import GameInProgressButton from './GameInProgressButton';
import instance from '../../util/Axios';
import { socket } from '../../util/Socket';
import { useEffect, useState } from 'react';

export default function GamesList() {
  const [games, setGames] = useState<
    { id: string; left: string; right: string }[]
  >([]);

  const gameStartedListener = ({ id, left, right }: GameStartedMessage) =>
    setGames([{ id, left, right }, ...games]);

  const gameEndedListener = ({ id: endedId }: GameEndedMessage) =>
    setGames(games.filter(({ id }) => id !== endedId));

  useEffect(() => {
    instance
      .get('/game/list')
      .then(({ data }) => {
        setGames(data.games);
        socket.on('gameStarted', gameStartedListener);
        socket.on('gameEnded', gameEndedListener);
      })
      .catch(() => {
        ErrorAlert(
          '진행 중인 게임 목록',
          '진행 중인 게임 목록을 불러오는데 실패했습니다<br/>다시 시도해주세요',
        );
      });
    return () => {
      socket.off('gameStarted', gameStartedListener);
      socket.off('gameEnded', gameEndedListener);
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
