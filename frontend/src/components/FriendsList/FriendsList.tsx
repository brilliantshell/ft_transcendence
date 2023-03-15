import Content from './Content';
import { Coordinates, HoverBox } from '../common/HoverBox';
import { socket } from '../../util/Socket';
import { useEffect, useRef, useState } from 'react';

// TODO : 친구 요청이 있으면 점 추가
// TODO : 친구 리스트 버튼 모양 수정

function FriendsList() {
  const [requestCount, setRequestCount] = useState<number | null>(null);
  const [isClicked, setIsClicked] = useState<boolean>(false);
  const [isHovered, setIsHovered] = useState<boolean>(false);
  const [hoverInfoCoords, setHoverInfoCoords] = useState<Coordinates>({
    x: 0,
    y: 0,
  });

  const friendsListRef = useRef<HTMLDivElement>(null);

  const btnOnClick = () => {
    setIsClicked(!isClicked);
  };

  const btnOnMouseEnter = () => setIsHovered(true);

  const btnOnMouseMove = (e: React.MouseEvent<HTMLButtonElement, MouseEvent>) =>
    setHoverInfoCoords({ x: e.clientX - 80, y: e.clientY + 20 });

  const btnOnMouseLeave = () => setIsHovered(false);

  useEffect(() => {
    function outsideCLick(event: MouseEvent) {
      if (
        friendsListRef.current &&
        !friendsListRef.current.contains(event.target as Node)
      ) {
        setIsClicked(false);
      }
    }
    document.addEventListener('click', outsideCLick);
    return () => {
      document.removeEventListener('click', outsideCLick);
    };
  }, [friendsListRef]);

  useEffect(() => {
    socket.emit(isClicked ? 'friendListOpened' : 'friendListClosed');
    if (!isClicked) {
      socket.on('friendRequestDiff', data => {
        if (requestCount === null) {
          setRequestCount(data.requestDiff);
        }
        setRequestCount(requestCount + data.requestDiff);
      });
    } else {
      socket.off('friendRequestDiff');
      setRequestCount(null);
    }
  }, [isClicked]);

  return (
    <div className="friendsList" ref={friendsListRef}>
      <button
        className="friendsListBtn"
        onClick={btnOnClick}
        onMouseEnter={btnOnMouseEnter}
        onMouseMove={btnOnMouseMove}
        onMouseLeave={btnOnMouseLeave}
      >
        <span className="material-symbols-outlined xxlarge">group</span>
      </button>
      {isClicked && <Content />}
      <HoverBox
        isHovered={isHovered}
        coords={hoverInfoCoords}
        content="친구 리스트"
      />
    </div>
  );
}

export default FriendsList;
