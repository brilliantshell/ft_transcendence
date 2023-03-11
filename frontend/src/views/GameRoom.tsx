import GameInfo from '../components/GameRoom/GameInfo';
import GameMenu from '../components/GameRoom/GameMenu';
import GamePlay from '../components/GameRoom/GamePlay';
import { isOptionSubmittedState } from '../util/Recoils';
import { socket } from '../util/Socket';
import { useCurrentUi } from '../components/hooks/CurrentUi';
import { useRequestGame } from '../components/GameRoom/hooks/GameDataHooks';
import { useParams } from 'react-router-dom';
import { useState } from 'react';
import { useRecoilValue } from 'recoil';

export default function GameRoom() {
  const { gameId } = useParams();
  if (gameId === undefined) {
    return <></>;
  }
  const [isConnected, setIsConnected] = useState(socket.connected);
  const isSubmitted = useRecoilValue(isOptionSubmittedState);

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
        gameInfo={{ id: gameId, isRank: isRank, players }}
        controllerType={{
          isLeft: isLeft,
          isPlayer:
            sessionStorage.getItem(`game-${gameId}-isPlayer`) === 'true',
        }}
      />
      <GameMenu
        gameId={gameId}
        isRank={isRank}
        isOptionSubmitted={isSubmitted}
      />
    </div>
  );
}
