import { ErrorAlert } from '../../util/Alert';
import instance from '../../util/Axios';
import { listenOnce } from '../../util/Socket';
import { useNavigate } from 'react-router-dom';
import { useState } from 'react';

export default function GameMenu({ gameId, isRank, isOwner }: GameMenuProps) {
  const nav = useNavigate();
  const [isStarted, setIsStarted] = useState<boolean>(false);

  return (
    <div className="gameMenu">
      {!isRank && !isStarted && (
        <button
          className="gameButton gameStartButton"
          type="button"
          onClick={() => {
            listenOnce('gameCancelled').then(() => {
              ErrorAlert(
                '게임 취소',
                '상대방이 게임에 접속하지 않아 취소되었습니다.',
              );
              nav(-1); // NOTE : 일반 게임일 때도?
            });
            instance
              .patch(`/game/${gameId}/start`)
              .then(() => {
                setIsStarted(true);
                sessionStorage.setItem(`game-${gameId}-isStarted`, 'true');
              })
              .catch(() => {
                ErrorAlert('게임 시작', '게임을 시작하는데 실패했습니다.');
                nav(-1);
              });
          }}
        >
          START GAME
        </button>
      )}
    </div>
  );
}

// SECTION : Interfaces

interface GameMenuProps {
  gameId: string;
  isRank: boolean;
  isOwner: boolean;
}
