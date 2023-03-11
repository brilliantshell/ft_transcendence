import GameOptionForm from './GameOptionForm';
import { generateWavyText } from '../common/Animation';

export default function GameOption({ gameId, isOwner }: GameOptionProps) {
  return (
    <div className="gameOption">
      <h1 className="xxlarge">GAME OPTIONS</h1>
      {isOwner ? (
        <GameOptionForm gameId={gameId} />
      ) : (
        <div className="gameOptionInvitedText large">
          <p>상대가 게임 옵션을 설정 중입니다</p>
          <p>잠시만 기다려주세요{generateWavyText('...', '-0.5rem')}</p>
        </div>
      )}
    </div>
  );
}

// SECTION : Interfaces
interface GameOptionProps {
  gameId: string;
  isOwner: boolean;
}
