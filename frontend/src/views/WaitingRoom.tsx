import GameQueueButton from '../components/WaitingRoom/GameQueueButton';
import GamesList from '../components/WaitingRoom/GamesList';
import '../style/WaitingRoom.css';

export default function WaitingRoom() {
  return (
    <div className="waitingRoom">
      <GameQueueButton />
      <GamesList />
    </div>
  );
}
