import { useEffect, useState } from 'react';
import instance from '../../util/Axios';
import User from '../User/User';
import { useSocketOn } from '../hooks/SocketOnHooks';
import { useRecoilValue } from 'recoil';
import { userActivity, userRelationship } from '../../util/Recoils';
import UserPendingReceivers from './UserPendingReceivers';
import { ErrorAlert } from '../../util/Alert';

function Content() {
  const [friends, setFriends] = useState<{
    friends: number[];
    pendingReceivers: number[];
    pendingSenders: number[];
  }>({ friends: [], pendingReceivers: [], pendingSenders: [] });
  const activityMap = useRecoilValue(userActivity);
  const relationshipMap = useRecoilValue(userRelationship);

  useSocketOn();
  useEffect(() => {
    instance
      .get('/user/friends')
      .then(result => {
        setFriends(result.data);
      })
      .catch(() => {
        ErrorAlert('친구 목록 로딩 실패', '오류가 발생했습니다.');
      });
  }, [relationshipMap]);

  return (
    <div className="friendsListContent">
      <div className="friendCategory">보낸 친구 요청</div>
      <div className="friendListMap">
        {friends.pendingSenders.map(id => (
          <User
            key={id}
            userId={id}
            activity={activityMap.get(id)}
            relationship={relationshipMap.get(id)}
          />
        ))}
      </div>
      <div className="friendCategory">받은 친구 요청</div>
      <div className="friendListMap">
        {friends.pendingReceivers.map(id => (
          <UserPendingReceivers
            key={id}
            userId={id}
            activity={activityMap.get(id)}
            relationship={relationshipMap.get(id)}
          ></UserPendingReceivers>
        ))}
      </div>
      <div className="friendCategory">내 친구</div>
      <div className="friendListMap">
        {friends.friends.map(id => (
          <User
            key={id}
            userId={id}
            activity={activityMap.get(id)}
            relationship={relationshipMap.get(id)}
          />
        ))}
      </div>
    </div>
  );
}

export default Content;
