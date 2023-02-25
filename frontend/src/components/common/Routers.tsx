import { Routes, Route } from 'react-router-dom';
import Profile from '../../views/Profile';
import Ranks from '../../views/Ranks';
import Chats from '../../views/Chats';

function Routers() {
  return (
    <Routes>
      <Route path="/" element={<Profile />} />
      <Route path="/profile/:id" element={<Profile />} />
      <Route path="/ranks" element={<Ranks />} />
      <Route path="/chats" element={<Chats />} />
    </Routes>
  );
}

export default Routers;
