import { useEffect } from 'react';
import { listenEvent, socket } from '../../util/Socket';

export function useCurrentUi(
  isConnected: boolean,
  setIsConnected: React.Dispatch<React.SetStateAction<boolean>>,
  ui: CurrentUi,
) {
  useEffect(() => {
    isConnected
      ? socket.emit('currentUi', { ui })
      : listenEvent('connect').then(() => {
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
  | `chatRooms-${number}`
  | `game-${string}`
  | 'profile'
  | 'ranks'
  | 'watchingGame'
  | 'waitingRoom';
