import { useEffect, useState } from 'react';
import { socket } from '../../util/Socket';
import Content from './Content';
// TODO :친구 요청 component 만들기

function FriendsList() {
  const [isClicked, setIsClicked] = useState<boolean>(false);
  const btnOnClick = () => {
    setIsClicked(!isClicked);
  };

  useEffect(() => {
    socket.emit(isClicked ? 'friendListOpened' : 'friendListClosed');

    if (!isClicked) {
      //   TODO :isClicked === false면 socket.on('friendRequestDiff')
    }
  }, [isClicked]);
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
