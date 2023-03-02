import GameInfo from '../components/GameRoom/GameInfo';
import GameMenu from '../components/GameRoom/GameMenu';
import GamePlay from '../components/GameRoom/GamePlay';
import instance from '../util/Axios';
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { ErrorAlert } from '../util/Alert';
import { socket } from '../util/Socket';
import { useCurrentUi } from '../components/hooks/EmitCurrentUi';
import '../style/GameRoom.css';

export default function GameRoom() {
  const { gameId } = useParams();
  const [isConnected, setIsConnected] = useState(socket.connected);
  const [gameInfo, setGameInfo] = useState<GameInfoData | null>(null);
  const [players, setPlayers] = useState<[string, string] | null>(null);

  useCurrentUi(isConnected, setIsConnected, `game-${gameId}`);

  useEffect(() => {
    isConnected &&
      instance
        .get(`/game/${gameId}`)
        .then(({ data }: { data: GameInfoData }) => {
          setGameInfo(data);
          setPlayers(
            data.isLeft
              ? [data.playerNickname, data.opponentNickname]
              : [data.opponentNickname, data.playerNickname],
          );
        })
        .catch(() =>
          ErrorAlert('게임 정보 요청', '게임 정보를 가져오는데 실패했습니다.'),
        );
  }, []);

  return (
    <div className="gameRoom">
      {gameInfo && players && (
        <>
          <GameInfo
            isRank={gameInfo.isRank}
            leftPlayer={players[0]}
            rightPlayer={players[1]}
          />
          <GamePlay isLeft={gameInfo.isLeft} />
          <GameMenu isOwner={gameInfo.isLeft} />
        </>
      )}
    </div>
  );
}

// SECTION : Interfaces

interface GameRoomProps {
  gameId: string;
}

interface GameInfoData {
  isRank: boolean;
  isLeft: boolean;
  playerId: number;
  playerNickname: string;
  opponentId: number;
  opponentNickname: string;
}
