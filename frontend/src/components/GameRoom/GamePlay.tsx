import { ControllerType, GameInfo } from './util/interfaces';
import { ErrorAlert } from '../../util/Alert';
import GameOption from './GameOption';
import { listenOnce } from '../../util/Socket';
import { useCanvasResize } from './hooks/GameResizeHooks';
import { useGamePlay } from './hooks/GamePlayHooks';
import { useLayoutEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function GamePlay({ gameInfo, controllerType }: GamePlayProps) {
  const nav = useNavigate();
  const parentRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dimensions = useCanvasResize(parentRef);
  const { id, isStarted, isRank } = gameInfo;

  useLayoutEffect(() => {
    if (isStarted) {
      listenOnce('gameCancelled').then(() => {
        ErrorAlert(
          '게임 취소',
          '상대방이 게임에 접속하지 않아 취소되었습니다.',
        );
        nav('/waiting-room');
      });
    }
  }, []);

  useGamePlay(isStarted, canvasRef, gameInfo, controllerType, dimensions);

  return (
    <div className="gamePlay" ref={parentRef}>
      {isStarted ? (
        <canvas
          id="gameBoard"
          width={dimensions.w}
          height={dimensions.h}
          ref={canvasRef}
        />
      ) : isRank ? (
        <></>
      ) : (
        <GameOption gameId={id} isOwner={controllerType.isLeft} />
      )}
    </div>
  );
}

// SECTION : Interfaces

interface GamePlayProps {
  gameInfo: GameInfo;
  controllerType: ControllerType;
}
