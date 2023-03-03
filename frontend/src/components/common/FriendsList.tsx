import { useEffect } from 'react';
import instance from '../../util/Axios';
import User from '../User';
import { socket } from '../../util/Socket';
// 친구 요청 component

function FriendsList() {
  useEffect(() => {
    socket.on('connect', () => {
      instance
        .get('/user/friends')
        .then(result => {
          console.log('friends', result.data);
        })
        .catch(reason => {
          console.error(reason);
        });
    });
    return () => {
      socket.off('connect');
    };
  }, []);

  return (
    <div className="dropup">
      <button className="dropup-btn">친구 리스트</button>
      <div className="dropup-content">
        <div>aaaa</div>
        <div>aaaa</div>
        <div>aaaa</div>
      </div>
    </div>
  );
}

export default FriendsList;
