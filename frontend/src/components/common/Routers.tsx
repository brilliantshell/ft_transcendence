import { Routes, Route } from 'react-router-dom';
import Profile from '../../views/Profile';
import Ranks from '../../views/Ranks';

function Routers() {
  return (
    <Routes>
      <Route path="/profile" element={<Profile />} />
      <Route path="/ranks" element={<Ranks />} />
    </Routes>
  );
}

export default Routers;
