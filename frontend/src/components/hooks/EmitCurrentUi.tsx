import { useEffect } from 'react';
import { listenOnce, socket } from '../../util/Socket';

export function useCurrentUi(
  isConnected: boolean,
  setIsConnected: React.Dispatch<React.SetStateAction<boolean>>,
  ui: CurrentUi,
) {
  useEffect(() => {
    isConnected
      ? socket.emit('currentUi', { ui })
      : listenOnce('connect').then(() => {
          socket.emit('currentUi', { ui });
          setIsConnected(true);
        });
    return () => {
      socket.off('connect');
    };
  }, []);
}

type CurrentUi =
  | 'chats'
  | `chatRooms-${string}`
  | `game-${string}`
  | 'profile'
  | 'ranks'
  | 'watchingGame'
  | 'waitingRoom';
