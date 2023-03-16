import { Coordinates, HoverBox } from '../common/HoverBox';
import { ErrorAlert } from '../../util/Alert';
import { GameInfo } from './util/interfaces';
import { GameInfoData } from './hooks/GameDataHooks';
import instance from '../../util/Axios';
import { useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';

export default function GameMenu({
  gameId,
  isRank,
  gameInfo,
  setGameInfo,
  isNormalSubmitted,
  setIsNormalSubmitted,
}: GameMenuProps) {
  const nav = useNavigate();
  const [isHovered, setIsHovered] = useState(false);
  const [hoverInfoCoords, setHoverInfoCoords] = useState<Coordinates>({
    x: 0,
    y: 0,
  });

  useEffect(() => {
    instance.get(`/game/${gameId}/normal`).then(({ data }) => {
      setIsNormalSubmitted(true);
    });
  }, []);

  if (isRank || gameInfo.isStarted) {
    return <div className="gameMenu"></div>;
  }

  const handleStartClick = () => {
    if (!isNormalSubmitted) {
      return;
    }
    instance
      .patch(`/game/${gameId}/start`)
      .then(() =>
        setGameInfo(prev => {
          if (prev) {
            return { ...prev, ...gameInfo, isStarted: true };
          }
          return null;
        }),
      )
      .catch(() => {
        ErrorAlert('게임 시작', '게임을 시작하는데 실패했습니다.');
        nav(-1);
      });
  };

  return (
    <div className="gameMenu">
      <button
        className={
          isNormalSubmitted ? 'gameStartButton' : 'gameStartButtonDeactivated'
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
        isHovered={!isNormalSubmitted && isHovered}
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
  gameInfo: GameInfo;
  setGameInfo: React.Dispatch<React.SetStateAction<GameInfoData | null>>;
  isNormalSubmitted: boolean;
  setIsNormalSubmitted: React.Dispatch<React.SetStateAction<boolean>>;
}
