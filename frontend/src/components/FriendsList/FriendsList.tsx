import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { socket } from '../../util/Socket';
import Content from './Content';
// TODO :친구 요청 component 만들기
// TODO : 친구 요청이 있으면 점 추가
// TODO : 친구 리스트 버튼 모양 수정

function FriendsList() {
  const [requestCount, setRequestCount] = useState<number | null>(null);
  const [isClicked, setIsClicked] = useState<boolean>(false);
  const btnOnClick = () => {
    setIsClicked(!isClicked);
  };
  const location = useLocation();

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

  if (location.pathname === '/login') {
    return <></>;
  }

  return (
    <div className="friendsList">
      <button className="friendsListBtn" onClick={btnOnClick}>
        친구 리스트
      </button>
      {isClicked && <Content />}
    </div>
  );
}

export default FriendsList;
