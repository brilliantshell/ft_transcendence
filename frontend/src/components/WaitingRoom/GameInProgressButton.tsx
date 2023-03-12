import { Coordinates, HoverBox } from '../common/HoverBox';
import { MouseEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function GameInProgressButton({
  gameId,
  leftNickname,
  rightNickname,
}: GameInProgressButtonProps) {
  const nav = useNavigate();
  const [isHovered, setIsHovered] = useState(false);
  const [hoverInfoCoords, setHoverInfoCoords] = useState<Coordinates>({
    x: 0,
    y: 0,
  });

  const handleMouseEnter = () => setIsHovered(true);

  const handleMouseLeave = (e: MouseEvent) => {
    setHoverInfoCoords({ x: e.clientX + 8, y: e.clientY + 20 });
    setIsHovered(false);
  };

  const handleMouseMove = (e: MouseEvent) =>
    setHoverInfoCoords({ x: e.clientX + 8, y: e.clientY + 20 });

  const handleClick = () => {
    sessionStorage.setItem(`game-${gameId}-isPlayer`, 'false');
    nav(`/game/${gameId}`);
  };

  return (
    <>
      <button
        className="gameInProgressButton xxlarge"
        onMouseEnter={handleMouseEnter}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onClick={handleClick}
      >
        <div>{leftNickname}</div>
        {isHovered ? (
          <div>
            <img src="../../public/assets/fire.gif" />
          </div>
        ) : (
          <div className="gameVersusText xlarge">VS</div>
        )}
        <div>{rightNickname}</div>
      </button>
      <HoverBox
        isHovered={isHovered}
        coords={hoverInfoCoords}
        content="게임 관전하기"
      />
    </>
  );
}

// SECTION: Interfaces

interface GameInProgressButtonProps {
  gameId: string;
  leftNickname: string;
  rightNickname: string;
}
