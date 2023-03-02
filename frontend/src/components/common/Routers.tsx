import { Routes, Route } from 'react-router-dom';
import GameRoom from '../../views/GameRoom';
import Profile from '../../views/Profile';
import Ranks from '../../views/Ranks';
import Chats from '../../views/Chats';
import WaitingRoom from '../../views/WaitingRoom';
import ChatRoom from '../../views/ChatRoom';

function Routers() {
  return (
    <Routes>
      <Route path="/" element={<Profile />} />
      <Route path="/profile/:id" element={<Profile />} />
      <Route path="/ranks" element={<Ranks />} />
      <Route path="/chats" element={<Chats />} />
      <Route path="/game/:gameId" element={<GameRoom />} />
      <Route path="/waiting-room" element={<WaitingRoom />} />
      <Route path="/chats/:id" element={<ChatRoom />} />
    </Routes>
  );
}

export default Routers;
