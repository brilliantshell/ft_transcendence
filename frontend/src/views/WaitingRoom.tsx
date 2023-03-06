import { useState } from 'react';
import GameQueueButton from '../components/WaitingRoom/GameQueueButton';
import GamesList from '../components/WaitingRoom/GamesList';
import { socket } from '../util/Socket';
import '../style/WaitingRoom.css';
import { useCurrentUi } from '../components/hooks/EmitCurrentUi';

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
