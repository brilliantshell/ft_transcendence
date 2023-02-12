import { BrowserRouter, NavLink, Routes, Route } from 'react-router-dom';
import Ranks from './views/Ranks';
import Profile from './views/Profile';
import './style/App.css';

function App() {
  return (
    <BrowserRouter>
      <header>headerheaderheaderheaderheader</header>
      <nav>
        {/* TODO :위에 로고 */}
        <ul>
          <li>
            <NavLink to="/profile">Profile</NavLink>
          </li>
          <li>
            <NavLink to="/ranks">Ranks</NavLink>
          </li>
          <li>
            <NavLink to="/chats">Chats</NavLink>
          </li>
          <li>
            <NavLink to="/game">Game</NavLink>
          </li>
        </ul>
        {/* TODO : 아래 로그아웃 */}
      </nav>
      <main>
        <Routes>
          <Route path="/profile" element={<Profile />} />
          <Route path="/ranks" element={<Ranks />} />
        </Routes>
      </main>
    </BrowserRouter>
  );
}

export default App;
