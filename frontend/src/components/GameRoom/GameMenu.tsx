import { Coordinates, HoverBox } from '../common/HoverBox';
import { ErrorAlert } from '../../util/Alert';
import instance from '../../util/Axios';
import { listenOnce } from '../../util/Socket';
import { useNavigate } from 'react-router-dom';
import { useState } from 'react';

export default function GameMenu({
  gameId,
  isRank,
  isOptionSubmitted,
}: GameMenuProps) {
  const nav = useNavigate();
  const [isStarted, setIsStarted] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [hoverInfoCoords, setHoverInfoCoords] = useState<Coordinates>({
    x: 0,
    y: 0,
  });

  if (isRank || isStarted) {
    return <div className="gameMenu"></div>;
  }

  const handleStartClick = () => {
    if (!isOptionSubmitted) {
      return;
    }
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
  };

  return (
    <div className="gameMenu">
      <button
        className={
          isOptionSubmitted ? 'gameStartButton' : 'gameStartButtonDeactivated'
        }
        type="button"
        onClick={handleStartClick}
        onMouseEnter={() => setIsHovered(true)}
        onMouseMove={e =>
          setHoverInfoCoords({ x: e.clientX + 8, y: e.clientY + 20 })
        }
        onMouseLeave={() => setIsHovered(false)}
      >
        START GAME
      </button>
      <HoverBox
        isHovered={!isOptionSubmitted && isHovered}
        coords={hoverInfoCoords}
        content={'모드가 선택되어야 시작할 수 있습니다'}
      />
    </div>
  );
}

// SECTION : Interfaces

interface GameMenuProps {
  gameId: string;
  isRank: boolean;
  isOptionSubmitted: boolean;
}
