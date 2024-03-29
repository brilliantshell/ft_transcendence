import { ConfirmAlert, ErrorAlert } from '../../util/Alert';
import instance from '../../util/Axios';
import { listenOnce, socket } from '../../util/Socket';
import { useEffect } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';

interface WebSocketConnectError extends Error {
  description?: number;
  context?: Object;
  type?: string;
}

export function useCurrentUi(
  isConnected: boolean,
  setIsConnected: React.Dispatch<React.SetStateAction<boolean>>,
  ui: CurrentUi,
  deps: React.DependencyList = [],
) {
  const nav = useNavigate();
  const newNormalGameHandler = ({
    gameId,
    inviterNickname,
  }: NewNormalGameMessage) => {
    ConfirmAlert(
      '게임 초대',
      `${inviterNickname}님이 게임에 초대했습니다.<br/>응하시겠습니다?`,
    ).then(({ isConfirmed, isDismissed }) => {
      if (isConfirmed) {
        nav(`/game/${gameId}`);
      } else if (isDismissed) {
        instance.delete(`/game/${gameId}`);
      }
    });
  };

  useEffect(() => {
    socket.once('connect_error', (error: WebSocketConnectError) => {
      socket.off();
      socket.close();
      if (error.description === 403) {
        ErrorAlert('로그인이 필요합니다.', '로그인 페이지로 이동합니다.');
        nav('/login');
      } else {
        ErrorAlert('서버와 연결할 수 없습니다.', '잠시 후 다시 시도해주세요.');
      }
    });
  }, [socket.connected]);

  useEffect(() => {
    socket.on('disconnect', () => {
      setTimeout(() => {
        socket.connect();
      }, 2000);
    });
    return () => {
      socket.off('disconnect');
    };
  }, []);

  useEffect(() => {
    if (isConnected) {
      socket.emit('currentUi', { ui });
    } else {
      listenOnce('connect').then(() => {
        socket.emit('currentUi', { ui }, () => setIsConnected(true));
      });
    }
    if (!ui.startsWith('game-')) {
      socket.on('newNormalGame', newNormalGameHandler);
    }
    return () => {
      socket.off('newNormalGame', newNormalGameHandler);
    };
  }, deps);
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
