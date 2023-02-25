import { Routes, Route } from 'react-router-dom';
import GameRoom from '../../views/GameRoom';
import Profile from '../../views/Profile';
import Ranks from '../../views/Ranks';

function Routers() {
  return (
    <Routes>
      <Route path="/profile" element={<Profile />} />
      <Route path="/ranks" element={<Ranks />} />
      <Route path="/game/example" element={<GameRoom gameId="example" />} />
    </Routes>
  );
}

export default Routers;
