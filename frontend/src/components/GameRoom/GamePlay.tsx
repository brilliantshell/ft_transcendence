import { ControllerType, GameInfo } from './util/interfaces';
import GameOption from './GameOption';
import { isOptionSubmittedState } from '../../util/Recoils';
import { useCanvasResize } from './hooks/GameResizeHooks';
import { useGamePlay } from './hooks/GamePlayHooks';
import { useLayoutEffect, useRef, useState } from 'react';
import { useResetRecoilState } from 'recoil';

export default function GamePlay({ gameInfo, controllerType }: GamePlayProps) {
  const parentRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const resetIsOptionSubmitted = useResetRecoilState(isOptionSubmittedState);
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
    return () => {
      if (isStarted && !gameInfo.isRank) {
        resetIsOptionSubmitted(); // NOTE : 여기서 하는게 맞는지 점검 필요
      }
    };
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
      ) : gameInfo.isRank ? (
        <></>
      ) : (
        <GameOption gameId={gameInfo.id} isOwner={controllerType.isLeft} />
      )}
    </div>
  );
}

// SECTION : Interfaces

interface GamePlayProps {
  gameInfo: GameInfo;
  controllerType: ControllerType;
}
