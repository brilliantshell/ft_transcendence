import GameInfo from '../components/GameRoom/GameInfo';
import GameMenu from '../components/GameRoom/GameMenu';
import GamePlay from '../components/GameRoom/GamePlay';
import { socket } from '../util/Socket';
import { useCurrentUi } from '../components/hooks/EmitCurrentUi';
import {
  useListenGameEvents,
  useRequestGame,
} from '../components/GameRoom/hooks/GameDataHooks';
import { useLocation, useParams } from 'react-router-dom';
import { useState } from 'react';
import '../style/GameRoom.css';

export default function GameRoom() {
  const { gameId } = useParams();
  if (gameId === undefined) return;
  const location = useLocation();
  const [isConnected, setIsConnected] = useState(socket.connected);
  const [isStarted, setIsStarted] = useState(false);
  const isPlayer = location.state?.isPlayer ?? false;

  useCurrentUi(isConnected, setIsConnected, `game-${gameId}`);
  const { gameInfo, players } = useRequestGame(
    isConnected,
    isPlayer,
    gameId,
    setIsStarted,
  );
  useListenGameEvents(isConnected, isPlayer);

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
            controllerType={{ isLeft: gameInfo.isLeft, isPlayer }}
            isStarted={isStarted}
          />
          <GameMenu
            isRank={gameInfo.isRank}
            isOwner={gameInfo.isLeft}
            startGame={() => setIsStarted(true)}
          />
        </>
      )}
    </div>
  );
}
