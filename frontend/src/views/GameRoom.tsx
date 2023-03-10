import GameInfo from '../components/GameRoom/GameInfo';
import GameMenu from '../components/GameRoom/GameMenu';
import GamePlay from '../components/GameRoom/GamePlay';
import { socket } from '../util/Socket';
import { useCurrentUi } from '../components/hooks/EmitCurrentUi';
import { useRequestGame } from '../components/GameRoom/hooks/GameDataHooks';
import { useParams } from 'react-router-dom';
import { useState } from 'react';
import '../style/GameRoom.css';

export default function GameRoom() {
  const { gameId } = useParams();
  if (gameId === undefined) {
    return;
  }
  const [isConnected, setIsConnected] = useState(socket.connected);

  useCurrentUi(isConnected, setIsConnected, `game-${gameId}`);
  const { gameInfo, players } = useRequestGame(isConnected, gameId);

  return (
    <div className="gameRoom">
      {gameInfo && players && (
        <>
          <GameInfo
            isRank={gameInfo.isRank}
            leftPlayer={players[0]}
            rightPlayer={players[1]}
          />
          <GamePlay
            gameInfo={{ id: gameId, players }}
            controllerType={{
              isLeft: gameInfo.isLeft,
              isPlayer:
                sessionStorage.getItem(`game-${gameId}-isPlayer`) === 'true',
            }}
          />
          <GameMenu
            gameId={gameId}
            isRank={gameInfo.isRank}
            isOwner={gameInfo.isLeft}
          />
        </>
      )}
    </div>
  );
}
