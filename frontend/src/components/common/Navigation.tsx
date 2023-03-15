import { Coordinates, HoverBox } from './HoverBox';
import { NavLink } from 'react-router-dom';
import instance from '../../util/Axios';
import { useEffect, useState } from 'react';

function NavigationButton({
  content,
  iconName,
  path,
  setIsHovered,
  setHoverInfoCoords,
  setContent,
}: NavigationButtonProps) {
  const [isCurrent, setIsCurrent] = useState(false);

  useEffect(() => {
    setIsCurrent(window.location.pathname === path);
  }, [window.location.pathname]);

  return (
    <NavLink to={path}>
      <li
        className={'navButton' + (isCurrent ? ' currentNav' : '')}
        onMouseEnter={() => {
          setIsHovered(true);
          setContent(content);
        }}
        onMouseMove={e => {
          setHoverInfoCoords({
            x: e.clientX + 8,
            y: e.clientY + 20,
          });
        }}
        onMouseLeave={() => {
          setIsHovered(false);
        }}
      >
        <span className="material-symbols-outlined">{iconName}</span>
      </li>
    </NavLink>
  );
}

function Navigation() {
  const [isHovered, setIsHovered] = useState(false);
  const [content, setContent] = useState('');
  const [hoverInfoCoords, setHoverInfoCoords] = useState<Coordinates>({
    x: 0,
    y: 0,
  });

  const navInfo = [
    { path: '/', hoverContent: '프로필', iconName: 'person' },
    { path: '/ranks', hoverContent: '랭킹', iconName: 'military_tech' },
    { path: '/chats', hoverContent: '채팅', iconName: 'chat' },
    {
      path: '/waiting-room',
      hoverContent: '게임',
      iconName: 'stadia_controller',
    },
  ];

  return (
    <nav>
      <img className="logo" src="/assets/logo.png" />
      <ul>
        {navInfo.map(({ path, hoverContent, iconName }) => (
          <NavigationButton
            key={path}
            content={hoverContent}
            iconName={iconName}
            path={path}
            setIsHovered={setIsHovered}
            setHoverInfoCoords={setHoverInfoCoords}
            setContent={setContent}
          />
        ))}
        <HoverBox
          isHovered={isHovered}
          coords={hoverInfoCoords}
          content={content}
        ></HoverBox>
      </ul>
      <button
        className="logoutButton"
        type="button"
        onClick={() => {
          instance
            .delete('logout')
            .then(() => {
              console.log('logout');
              window.location.href = '/login';
              sessionStorage.clear();
            })
            .catch(err => console.log(err.response));
        }}
      >
        logout
      </button>
    </nav>
  );
}

// SECTION: Interfaces

interface NavigationButtonProps {
  content: string;
  iconName: string;
  path: string;
  setIsHovered: React.Dispatch<React.SetStateAction<boolean>>;
  setHoverInfoCoords: React.Dispatch<React.SetStateAction<Coordinates>>;
  setContent: React.Dispatch<React.SetStateAction<string>>;
}

export default Navigation;
