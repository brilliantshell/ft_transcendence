import GameInfo from '../components/GameRoom/GameInfo';
import GameMenu from '../components/GameRoom/GameMenu';
import GamePlay from '../components/GameRoom/GamePlay';
import { isOptionSubmittedState } from '../util/Recoils';
import { socket } from '../util/Socket';
import { useCurrentUi } from '../components/hooks/CurrentUi';
import { useRequestGame } from '../components/GameRoom/hooks/GameDataHooks';
import { useNavigate, useParams } from 'react-router-dom';
import { useState } from 'react';
import { useRecoilValue } from 'recoil';
import { ErrorAlert } from '../util/Alert';

export default function GameRoom() {
  const nav = useNavigate();
  const { gameId } = useParams();
  if (gameId === undefined) {
    return <></>;
  } else if (!gameId.match(/^[0-9A-Za-z_-]{21}$/)) {
    ErrorAlert('잘못된 접근입니다.', '이전 페이지로 이동합니다.').then(() =>
      nav(-1),
    );
  }
  const [isConnected, setIsConnected] = useState(socket.connected);
  const isOptionSubmitted = useRecoilValue(isOptionSubmittedState);

  useCurrentUi(isConnected, setIsConnected, `game-${gameId}`);
  const { gameInfo, players } = useRequestGame(isConnected, gameId);

  if (!gameInfo || !players) {
    return <></>;
  }
  const { isRank, isLeft } = gameInfo;

  return (
    <div className="gameRoom">
      <GameInfo
        isRank={isRank}
        leftPlayer={players[0]}
        rightPlayer={players[1]}
      />
      <GamePlay
        gameInfo={{ id: gameId, isRank, players }}
        controllerType={{
          isLeft: isLeft,
          isPlayer:
            sessionStorage.getItem(`game-${gameId}-isPlayer`) === 'true',
        }}
      />
      <GameMenu
        gameId={gameId}
        isRank={isRank}
        isOptionSubmitted={isOptionSubmitted}
      />
    </div>
  );
}
