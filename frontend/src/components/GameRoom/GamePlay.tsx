import { useRef } from 'react';
import { useCanvasResize } from './hooks/GameResizeHooks';
import { useGamePlay } from './hooks/GamePlayHooks';

export default function GamePlay({ isLeft, isStarted }: GamePlayProps) {
  const parentRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { width, height } = useCanvasResize(parentRef);
  useGamePlay(canvasRef, isLeft, width, height);

  return (
    <div className="gamePlay" ref={parentRef}>
      {isStarted && (
        <canvas id="gameBoard" width={width} height={height} ref={canvasRef} />
      )}
    </div>
  );
}

// SECTION : Interfaces

interface GamePlayProps {
  isLeft: boolean;
  isStarted: boolean;
}
