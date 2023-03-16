import { ErrorAlert } from '../util/Alert';
import GameInfo from '../components/GameRoom/GameInfo';
import GameMenu from '../components/GameRoom/GameMenu';
import GamePlay from '../components/GameRoom/GamePlay';
import { socket } from '../util/Socket';
import { useCurrentUi } from '../components/hooks/CurrentUi';
import { useNavigate, useParams } from 'react-router-dom';
import {
  GameInfoData,
  useRequestGame,
} from '../components/GameRoom/hooks/GameDataHooks';
import { useState } from 'react';

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

  const [gameInfo, setGameInfo] = useState<GameInfoData | null>(null);
  const [isConnected, setIsConnected] = useState(socket.connected);

  const [isNormalSubmitted, setIsNormalSubmitted] = useState(false);

  useCurrentUi(isConnected, setIsConnected, `game-${gameId}`);
  useRequestGame(isConnected, gameId, setGameInfo);

  if (!gameInfo) {
    return <></>;
  }

  const { isRank, isPlayer, isLeft, isStarted, players } = gameInfo;

  return (
    <div className="gameRoom">
      <GameInfo
        isRank={isRank}
        leftPlayer={players[0]}
        rightPlayer={players[1]}
      />
      <GamePlay
        gameInfo={{ id: gameId, isRank, isStarted, players }}
        controllerType={{ isLeft, isPlayer }}
      />
      <GameMenu
        gameId={gameId}
        isRank={isRank}
        gameInfo={{ id: gameId, isRank, isStarted, players }}
        setGameInfo={setGameInfo}
        isNormalSubmitted={isNormalSubmitted}
        setIsNormalSubmitted={setIsNormalSubmitted}
      />
    </div>
  );
}
