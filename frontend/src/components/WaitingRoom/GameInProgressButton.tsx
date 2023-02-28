import { MouseEvent, useState } from 'react';
import { HoverBox } from '../common/HoverBox';

export default function GameInProgressButton({
  leftNickname,
  rightNickname,
}: GameInProgressButtonProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [hoverInfoCoords, setHoverInfoCoords] = useState<{
    x: number;
    y: number;
  }>({ x: 0, y: 0 });

  const handleMouseEnter = () => setIsHovered(true);

  const handleMouseLeave = (e: MouseEvent) => {
    setHoverInfoCoords({ x: e.clientX + 8, y: e.clientY + 20 });
    setIsHovered(false);
  };

  const handleMouseMove = (e: MouseEvent) =>
    setHoverInfoCoords({ x: e.clientX + 8, y: e.clientY + 20 });

  return (
    <>
      <button
        className="gameInProgressButton xxlarge"
        onMouseEnter={handleMouseEnter}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
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
  leftNickname: string;
  rightNickname: string;
}
