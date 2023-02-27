import GameStartButton from '../components/WaitingRoom/GameStartButton';
import GamesInProgress from '../components/WaitingRoom/GamesInProgress';
import '../style/WaitingRoom.css';

export default function WaitingRoom() {
  return (
    <div className="waitingRoom">
      <GameStartButton />
      <GamesInProgress />
    </div>
  );
}
