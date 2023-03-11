import GameOptionForm from './GameOptionForm';
import { generateWavyText } from '../common/Animation';
import { isOptionSubmittedState } from '../../util/Recoils';
import { listenOnce } from '../../util/Socket';
import { useEffect } from 'react';
import { useRecoilState } from 'recoil';

export default function GameOption({ gameId, isOwner }: GameOptionProps) {
  const [isOptionSubmitted, setIsOptionSubmitted] = useRecoilState(
    isOptionSubmittedState,
  );
  useEffect(() => {
    if (!isOwner) {
      listenOnce<{ mode: 1 | 2 | 3 }>('gameOption').then(() =>
        setIsOptionSubmitted(true),
      );
    }
  }, []);

  return (
    <div className={'gameOption'}>
      <h1 className="xxlarge">GAME OPTIONS</h1>
      {isOptionSubmitted ? (
        <div className="gameOptionText large">
          <p>게임 모드가 설정되었습니다!</p>
          <p>
            <span className="gameOptionButtonLikeText">START GAME</span> 버튼을
            눌러 게임을 시작하세요 :D
          </p>
        </div>
      ) : (
        <>
          {isOwner ? (
            <GameOptionForm gameId={gameId} />
          ) : (
            <div className="gameOptionText large">
              <p>상대가 게임 모드를 설정 중입니다</p>
              <p>잠시만 기다려주세요{generateWavyText('...', '-0.5rem')}</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// SECTION : Interfaces
interface GameOptionProps {
  gameId: string;
  isOwner: boolean;
}
