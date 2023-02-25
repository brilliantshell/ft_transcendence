import { NavLink } from 'react-router-dom';

function Navigation() {
  return (
    <nav>
      {/* TODO :위에 로고 */}
      <ul>
        <li>
          <NavLink to="/">Profile</NavLink>
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
  );
}

export default Navigation;
