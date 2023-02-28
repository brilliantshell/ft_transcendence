import { useEffect } from 'react';
import { GamePainter } from '../util/GamePainter';

export function useGamePlay(
  canvasRef: React.RefObject<HTMLCanvasElement>,
  isLeft: boolean,
  w: number,
  h: number,
) {
  useEffect(() => {
    const canvas = canvasRef.current;
    let painter: GamePainter;
    if (canvas) {
      const context = canvas.getContext('2d');
      if (context && w > 0) {
        painter = new GamePainter(isLeft, context, { w, h });
        document.addEventListener('keyup', painter.keyUpHandler.bind(painter));
        document.addEventListener(
          'keydown',
          painter.keyDownHandler.bind(painter),
        );
        painter.startGame();
      }
    }
    return () => {
      if (painter !== undefined) {
        clearInterval(painter.intervalId);
        document.removeEventListener(
          'keyup',
          painter.keyUpHandler.bind(painter),
        );
        document.removeEventListener(
          'keydown',
          painter.keyDownHandler.bind(painter),
        );
      }
    };
  });
}
