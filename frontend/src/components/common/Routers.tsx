import ChatRoom from '../../views/ChatRoom';
import Chats from '../../views/Chats';
import GameRoom from '../../views/GameRoom';
import { NotFoundComponent } from './NotFoundComponent';
import Profile from '../../views/Profile';
import Ranks from '../../views/Ranks';
import { Routes, Route } from 'react-router-dom';
import WaitingRoom from '../../views/WaitingRoom';

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
      <Route path="*" element={<NotFoundComponent />} />
    </Routes>
  );
}

export default Routers;
