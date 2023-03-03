import GameInfo from '../components/GameRoom/GameInfo';
import GameMenu from '../components/GameRoom/GameMenu';
import GamePlay from '../components/GameRoom/GamePlay';
import { useState } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import { socket } from '../util/Socket';
import { useCurrentUi } from '../components/hooks/EmitCurrentUi';
import {
  useListenGameEvents,
  useRequestGame,
} from '../components/GameRoom/hooks/GameDataHooks';
import '../style/GameRoom.css';

export default function GameRoom() {
  const { gameId } = useParams();
  const location = useLocation();
  const [isConnected, setIsConnected] = useState(socket.connected);
  const [isStarted, setIsStarted] = useState(false);
  const isSpectator = location.state?.isSpectator ?? false;

  useCurrentUi(isConnected, setIsConnected, `game-${gameId}`);
  const { gameInfo, players } = useRequestGame(
    isConnected,
    isSpectator,
    gameId ?? 'example',
    setIsStarted,
  );
  useListenGameEvents(isConnected, isSpectator);

  return (
    <div className="gameRoom">
      {gameInfo && players && (
        <>
          <GameInfo
            isRank={gameInfo.isRank}
            leftPlayer={players[0]}
            rightPlayer={players[1]}
          />
          <GamePlay isLeft={gameInfo.isLeft} isStarted={isStarted} />
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
