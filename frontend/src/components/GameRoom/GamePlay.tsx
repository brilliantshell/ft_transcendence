import { useRef } from 'react';
import { useCanvasResize } from './hooks/GamePlayHooks';
import '../../style/GameRoom.css';

export default function GamePlay() {
  const parentRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { width, height } = useCanvasResize(parentRef);

  return (
    <div className="gamePlay" ref={parentRef}>
      <canvas id="gameBoard" width={width} height={height} ref={canvasRef} />
    </div>
  );
}
