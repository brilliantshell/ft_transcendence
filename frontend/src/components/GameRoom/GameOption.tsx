import { ErrorAlert } from '../../util/Alert';
import GameOptionForm from './GameOptionForm';
import { generateWavyText } from '../common/Animation';
import instance from '../../util/Axios';
import { listenOnce, socket } from '../../util/Socket';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function GameOption({ gameId, isOwner }: GameOptionProps) {
  const nav = useNavigate();
  const [hasInvitedJoined, setHasInvitedJoined] = useState(false);
  const [isOptionSubmitted, setIsOptionSubmitted] = useState(false);

  useEffect(() => {
    instance
      .get(`/game/${gameId}/normal`)
      .then(
        ({
          data,
        }: {
          data: { hasInvitedJoined: boolean; isOptionSubmitted: boolean };
        }) => {
          setHasInvitedJoined(data.hasInvitedJoined);
          setIsOptionSubmitted(data.isOptionSubmitted);
          listenOnce('gameOption').then(() => setIsOptionSubmitted(true));
          if (isOwner) {
            listenOnce('gameCancelled').then(() => {
              ErrorAlert(
                '게임 취소',
                '상대방이 게임에 접속하지 않아 취소되었습니다.',
              );
              nav('/waiting-room');
            });
            if (hasInvitedJoined === false) {
              listenOnce('gameInvitedJoined').then(() =>
                setHasInvitedJoined(true),
              );
            }
          }
        },
      );

    return () => {
      socket.off('gameInvitedJoined');
      socket.off('gameOption');
    };
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
            hasInvitedJoined ? (
              <GameOptionForm
                gameId={gameId}
                setIsOptionSubmitted={setIsOptionSubmitted}
              />
            ) : (
              <div className="gameOptionText large">
                <p>상대가 게임 초대를 수락할 때까지</p>
                <p>
                  잠시만 기다려주세요
                  {generateWavyText('...', '-0.5rem')}
                </p>
              </div>
            )
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
