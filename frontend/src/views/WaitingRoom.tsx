import GamesList from '../components/WaitingRoom/GamesList';
import GameQueueButton from '../components/WaitingRoom/GameQueueButton';
import { socket } from '../util/Socket';
import { useCurrentUi } from '../components/hooks/CurrentUi';
import { useState } from 'react';

export default function WaitingRoom() {
  const [isConnected, setIsConnected] = useState(socket.connected);

  useCurrentUi(isConnected, setIsConnected, 'waitingRoom');

  return (
    <div className="waitingRoom">
      {isConnected && (
        <>
          <GameQueueButton />
          <GamesList />
        </>
      )}
    </div>
  );
}
