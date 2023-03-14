import { useEffect, useRef, useState } from 'react';
import { socket } from '../../util/Socket';
import Content from './Content';

// TODO : 친구 요청이 있으면 점 추가
// TODO : 친구 리스트 버튼 모양 수정

function FriendsList() {
  const [requestCount, setRequestCount] = useState<number | null>(null);
  const [isClicked, setIsClicked] = useState<boolean>(false);

  const friendsListRef = useRef<HTMLDivElement>(null);

  const btnOnClick = () => {
    setIsClicked(!isClicked);
  };
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
      <button className="friendsListBtn" onClick={btnOnClick}>
        친구 리스트
      </button>
      {isClicked && <Content />}
    </div>
  );
}

export default FriendsList;
