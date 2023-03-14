import { ControllerType, GameInfo } from './util/interfaces';
import { ErrorAlert } from '../../util/Alert';
import GameOption from './GameOption';
import { isOptionSubmittedState } from '../../util/Recoils';
import { listenOnce } from '../../util/Socket';
import { useCanvasResize } from './hooks/GameResizeHooks';
import { useGamePlay } from './hooks/GamePlayHooks';
import { useLayoutEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useResetRecoilState } from 'recoil';

export default function GamePlay({ gameInfo, controllerType }: GamePlayProps) {
  const nav = useNavigate();
  const parentRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const resetIsOptionSubmitted = useResetRecoilState(isOptionSubmittedState);
  const dimensions = useCanvasResize(parentRef);
  const [gameMode, setGameMode] = useState<0 | 1 | 2>(0);
  const [isStarted, setIsStarted] = useState(
    sessionStorage.getItem(`game-${gameInfo.id}-isStarted`) === 'true',
  );

  useLayoutEffect(() => {
    const intervalId = setInterval(() => {
      if (sessionStorage.getItem(`game-${gameInfo.id}-isStarted`) === 'true') {
        clearInterval(intervalId);
        setIsStarted(true);
        listenOnce('gameCancelled').then(() => {
          ErrorAlert(
            '게임 취소',
            '상대방이 게임에 접속하지 않아 취소되었습니다.',
          );
          nav('/waiting-room');
        });
      }
    }, 100);
    return () => {
      if (!gameInfo.isRank) {
        resetIsOptionSubmitted(); // NOTE : 여기서 하는게 맞는지 점검 필요
      }
    };
  }, []);

  useGamePlay(
    isStarted,
    canvasRef,
    gameInfo,
    controllerType,
    dimensions,
    gameMode,
  );

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
        <GameOption
          gameId={gameInfo.id}
          isOwner={controllerType.isLeft}
          setGameMode={setGameMode}
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
