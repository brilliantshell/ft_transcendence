import { ControllerType, Dimensions, GameInfo } from '../util/interfaces';
import { GamePainter } from '../util/GamePainter';
import { socket } from '../../../util/Socket';
import { useEffect } from 'react';

export function useGamePlay(
  canvasRef: React.RefObject<HTMLCanvasElement>,
  gameInfo: GameInfo,
  controllerType: ControllerType,
  dimensions: Dimensions,
) {
  useEffect(() => {
    const keyDownHandler = (e: KeyboardEvent) => {
      if (e.key === 'Up' || e.key === 'ArrowUp') {
        e.preventDefault();
        socket.emit('gamePlayerY', {
          gameId: gameInfo.id,
          isLeft: controllerType.isLeft,
          isUp: true,
        });
      } else if (e.key === 'Down' || e.key === 'ArrowDown') {
        e.preventDefault();
        socket.emit('gamePlayerY', {
          gameId: gameInfo.id,
          isLeft: controllerType.isLeft,
          isUp: false,
        });
      }
    };

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
          document.addEventListener('keydown', keyDownHandler);
        }
        painter.drawGame();
      }
    }
    return () => {
      if (painter !== undefined) {
        socket.off('gameData');
        if (controllerType.isPlayer) {
          document.removeEventListener('keydown', keyDownHandler);
        }
      }
    };
  });
}
