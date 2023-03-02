// relationship on - 창이 켜져있을때
// diff off - 창이 켜져있을 때 (count = 0 초기화)

import { useEffect } from 'react';
import instance from '../../util/Axios';
import User from '../User/User';
import { useSocketOn } from '../hooks/SocketOnHooks';
import socket from '../../util/Socket';

function Content() {
  // TODO : emit
  useSocketOn();
  useEffect(() => {
    socket.off('friendRequestDiff');
    instance
      .get('/user/friends')
      .then(result => {
        // console.log('friends', result.data);
      })
      .catch(reason => {
        console.error(reason);
      });
    return () => {
      // TODO : emit
    };
  }, []);

  return (
    <div className="friendsListContent">
      <User userId={25136}></User>
      {/* <User userId={41472}></User> */}
      <div>aaaa</div>
      <div>aaaa</div>
    </div>
  );
}

export default Content;
