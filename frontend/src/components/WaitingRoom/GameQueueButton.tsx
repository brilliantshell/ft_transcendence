import { useState } from 'react';
import instance from '../../util/Axios';
import { listenEvent, socket } from '../../util/Socket';
import { useNavigate } from 'react-router-dom';

export default function GameEnterQueueButton() {
  const nav = useNavigate();
  const [hasEnteredQueue, setHasEnteredQueue] = useState(false);

  const handleButtonClick = () => {
    hasEnteredQueue
      ? instance
          .delete('/game/queue')
          .then(() => setHasEnteredQueue(false))
          .catch(err => {})
      : instance
          .post('/game/queue')
          .then(() => {
            setHasEnteredQueue(true);
            listenEvent<NewGameMessage>('newGame').then(({ gameId }) =>
              nav(`/game/${gameId}`),
            );
          })
          .catch(err => {});
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
