import { ControllerType, Dimensions, GameInfo } from '../util/interfaces';
import { GamePainter } from '../util/GamePainter';
import { useEffect } from 'react';

export function useGamePlay(
  canvasRef: React.RefObject<HTMLCanvasElement>,
  gameInfo: GameInfo,
  controllerType: ControllerType,
  dimensions: Dimensions,
) {
  useEffect(() => {
    const canvas = canvasRef.current;
    let painter: GamePainter;
    if (canvas) {
      const context = canvas.getContext('2d');
      if (context && dimensions.w > 0) {
        painter = new GamePainter(
          context,
          gameInfo,
          controllerType,
          dimensions,
        );
        if (controllerType.isPlayer) {
          document.addEventListener(
            'keyup',
            painter.keyUpHandler.bind(painter),
          );
          document.addEventListener(
            'keydown',
            painter.keyDownHandler.bind(painter),
          );
          painter.startGame();
        } else {
          painter.spectateGame();
        }
      }
    }
    return () => {
      if (painter !== undefined) {
        clearInterval(painter.intervalId);
        if (controllerType.isPlayer) {
          document.removeEventListener(
            'keyup',
            painter.keyUpHandler.bind(painter),
          );
          document.removeEventListener(
            'keydown',
            painter.keyDownHandler.bind(painter),
          );
        }
      }
    };
  });
}
