import { ErrorAlert } from '../../util/Alert';
import instance from '../../util/Axios';
import { listenEvent, socket } from '../../util/Socket';
import { useNavigate } from 'react-router-dom';
import { useState } from 'react';

export default function GameEnterQueueButton() {
  const nav = useNavigate();
  const [hasEnteredQueue, setHasEnteredQueue] = useState(false);

  const handleButtonClick = () => {
    hasEnteredQueue
      ? instance
          .delete('/game/queue')
          .then(() => setHasEnteredQueue(false))
          .catch(err => {
            // NOTE : 서버에서 에러가 날 케이스가 없을 것으로 보이는데 한번 더 확인 필요
          })
      : instance
          .post('/game/queue')
          .then(() => {
            setHasEnteredQueue(true);
            listenEvent<NewGameMessage>('newGame').then(({ gameId }) =>
              nav(`/game/${gameId}`, { state: { isPlayer: true } }),
            );
          })
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
  };

  const generateWavyText = (text: string) => {
    return (
      <>
        {text.split('').map((char, i) => (
          <span key={i} style={{ '--i': i.toString() } as React.CSSProperties}>
            {char === ' ' ? '\u00A0' : char}
          </span>
        ))}
      </>
    );
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
        {hasEnteredQueue && generateWavyText('...')}
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
