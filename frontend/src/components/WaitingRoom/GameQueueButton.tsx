import { ErrorAlert } from '../../util/Alert';
import instance from '../../util/Axios';
import { generateWavyText } from '../common/Animation';
import { listenOnce } from '../../util/Socket';
import { useNavigate } from 'react-router-dom';
import { useState } from 'react';

export default function GameEnterQueueButton() {
  const nav = useNavigate();
  const [hasEnteredQueue, setHasEnteredQueue] = useState(false);

  const handleButtonClick = () => {
    if (hasEnteredQueue) {
      instance.delete('/game/queue').finally(() => setHasEnteredQueue(false));
    } else {
      listenOnce<NewGameMessage>('newGame').then(({ gameId }) => {
        sessionStorage.setItem(`game-${gameId}-isPlayer`, 'true');
        nav(`/game/${gameId}`);
      });
      instance
        .post('/game/queue')
        .then(() => setHasEnteredQueue(true))
        .catch(err => {
          switch (err.response.status) {
            case 400:
              ErrorAlert('게임 매칭 큐', '이미 진행 중인 게임이 있습니다.');
              break;
            case 409:
              ErrorAlert('게임 매칭 큐', '이미 매칭 큐에 등록되어 있습니다.');
              break;
            default:
              ErrorAlert(
                '게임 매칭 큐',
                '오류가 발생했습니다. 새로고침 후 다시 시도해주세요.',
              );
              break;
          }
        });
    }
  };

  return (
    <button
      className={
        (hasEnteredQueue ? 'gameQueueButtonClicked' : 'gameQueueButton') +
        ' xxxlarge'
      }
      type="button"
      onClick={handleButtonClick}
    >
      <p>
        {hasEnteredQueue ? 'Looking for an Opponent' : 'GAME START'}
        {hasEnteredQueue && generateWavyText('...', '-1rem')}
      </p>
      {hasEnteredQueue && (
        <p className="large">
          (새로고침을 하거나 버튼을 한번 더 누르면 매칭 요청이 취소됩니다)
        </p>
      )}
    </button>
  );
}

// SECTION : Interfaces

interface NewGameMessage {
  gameId: string;
}
