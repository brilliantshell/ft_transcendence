import { ConfirmAlert } from '../../util/Alert';
import { listenOnce, socket } from '../../util/Socket';
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export function useCurrentUi(
  isConnected: boolean,
  setIsConnected: React.Dispatch<React.SetStateAction<boolean>>,
  ui: CurrentUi,
) {
  const nav = useNavigate();

  const newNormalGameHandler = ({
    gameId,
    inviterNickname,
  }: NewNormalGameMessage) => {
    ConfirmAlert(
      '게임 초대',
      `${inviterNickname}님이 게임에 초대했습니다.<br/>응하시겠습니다?`,
    ).then(({ isConfirmed }) => {
      if (isConfirmed) {
        sessionStorage.setItem(`game-${gameId}-isPlayer`, 'true');
        nav(`/game/${gameId}`);
      }
    });
  };

  useEffect(() => {
    socket.io.on('error', (error: any) => {
      if (error.description === 403) {
        nav('/login');
      }
      socket.close();
    });
    if (isConnected) {
      socket.emit('currentUi', { ui });
      if (!ui.startsWith('game-')) {
        socket.on('newNormalGame', newNormalGameHandler);
      }
    } else {
      listenOnce('connect').then(() => {
        socket.emit('currentUi', { ui });
        setIsConnected(true);
      });
    }
    return () => {
      socket.off('newNormalGame', newNormalGameHandler);
    };
  }, []);
}

// SECTION : Types & Interfaces

type CurrentUi =
  | 'chats'
  | `chatRooms-${string}`
  | `game-${string}`
  | 'profile'
  | 'ranks'
  | 'watchingGame'
  | 'waitingRoom';

interface NewNormalGameMessage {
  gameId: string;
  inviterNickname: string;
}
