// relationship on - 창이 켜져있을때
// diff off - 창이 켜져있을 때 (count = 0 초기화)

import { useEffect, useState } from 'react';
import instance from '../../util/Axios';
import User from '../User/User';
import { useSocketOn } from '../hooks/SocketOnHooks';
import { socket } from '../../util/Socket';
import { useRecoilValue } from 'recoil';
import { userActivity, userRelationship } from '../../util/Recoils';

function Content() {
  const [friends, setFriends] = useState<number[]>([]);
  const activityMap = useRecoilValue(userActivity);
  const relationshipMap = useRecoilValue(userRelationship);
  // TODO : emit friendList

  useSocketOn();
  useEffect(() => {
    socket.off('friendRequestDiff');
    instance
      .get('/user/friends')
      .then(result => {
        setFriends(result.data.friends);
      })
      .catch(reason => {
        console.error(reason);
      });
    return () => {
      //
    };
  }, []);

  return (
    <div className="friendsListContent">
      {friends.map(id => (
        <User
          key={id}
          userId={id}
          activity={activityMap.get(id)}
          relationship={relationshipMap.get(id)}
        />
      ))}
    </div>
  );
}

export default Content;
