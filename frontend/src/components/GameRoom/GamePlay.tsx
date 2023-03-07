import { ControllerType, GameInfo } from './util/interfaces';
import { useRef } from 'react';
import { useCanvasResize } from './hooks/GameResizeHooks';
import { useGamePlay } from './hooks/GamePlayHooks';

export default function GamePlay({
  gameInfo,
  controllerType,
  isStarted,
}: GamePlayProps) {
  const parentRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dimensions = useCanvasResize(parentRef);
  useGamePlay(canvasRef, gameInfo, controllerType, dimensions);
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
  isStarted: boolean;
}
