import { useEffect, useState } from 'react';
import GameInfo from '../components/GameRoom/GameInfo';
import GameMenu from '../components/GameRoom/GameMenu';
import GamePlay from '../components/GameRoom/GamePlay';
import '../style/GameRoom.css';
import instance from '../util/Axios';

export default function GameRoom({ gameId }: GameRoomProps) {
  const [gameInfo, setGameInfo] = useState<GameInfo | null>({
    isRank: false,
    isLeft: true,
    playerId: 0,
    playerNickname: 'ghan',
    opponentId: 0,
    opponentNickname: 'yongjule',
  });
  const [players, setPlayers] = useState<[string, string] | null>([
    'ghan',
    'yongjule',
  ]);
  useEffect(() => {
    instance;
    // .get(`/game/${gameId}`)
    // .then(({ data }) => {
    //   setGameInfo(data);
    //   setPlayers(
    //     data.isLeft
    //       ? [data.playerNickname, data.opponentNickname]
    //       : [data.opponentNickname, data.playerNickname],
    //   );
    // })
    // .catch(error => {
    //   console.error(error); // FIXME : 추후 적절한 에러처리
    // });
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
          <GamePlay />
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

interface GameInfo {
  isRank: boolean;
  isLeft: boolean;
  playerId: number;
  playerNickname: string;
  opponentId: number;
  opponentNickname: string;
}
