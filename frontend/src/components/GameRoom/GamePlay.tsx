import { ControllerType, GameInfo } from './util/interfaces';
import { useCanvasResize } from './hooks/GameResizeHooks';
import { useGamePlay } from './hooks/GamePlayHooks';
import { useLayoutEffect, useRef, useState } from 'react';

export default function GamePlay({ gameInfo, controllerType }: GamePlayProps) {
  const parentRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dimensions = useCanvasResize(parentRef);
  const [isStarted, setIsStarted] = useState(
    sessionStorage.getItem(`game-${gameInfo.id}-isStarted`) === 'true',
  );
  useLayoutEffect(() => {
    const intervalId = setInterval(() => {
      if (sessionStorage.getItem(`game-${gameInfo.id}-isStarted`) === 'true') {
        clearInterval(intervalId);
        setIsStarted(true);
      }
    }, 100);
  }, []);
  useGamePlay(isStarted, canvasRef, gameInfo, controllerType, dimensions);
  return (
    <div className="gamePlay" ref={parentRef}>
      {isStarted && (
        <canvas
          id="gameBoard"
          width={dimensions.w}
          height={dimensions.h}
          ref={canvasRef}
        />
      )}
    </div>
  );
}

// SECTION : Interfaces

interface GamePlayProps {
  gameInfo: GameInfo;
  controllerType: ControllerType;
}
