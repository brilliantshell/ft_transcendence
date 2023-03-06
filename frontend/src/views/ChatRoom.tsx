import { useParams } from 'react-router-dom';
import { useEffect } from 'react';
import User from '../components/User/User';
import {
  activityData,
  relationshipData,
  useSocketOn,
} from '../components/hooks/SocketOnHooks';
import { useRecoilValue } from 'recoil';
import { userActivity, userRelationship } from '../util/Recoils';

function ChatRoom() {
  const params = useParams();
  const activityMap = useRecoilValue(userActivity);
  const relationshipMap = useRecoilValue(userRelationship);
  //   const [chatsId, setChatsId] = useState();
  //   GET /chats/{:channelId} ⇒ 200 || 403 (Forbidden) - 맴버 정보 / 맴버가 아니면 403!
  //   GET /chats/{:channelId}/message?range=n,m ⇒ 200 || 403 - 메시지
  // POST /chats/{:channelId}/message ⇒ 201 || 403 - 메시지 전송

  useSocketOn();
  useEffect(() => {
    return () => {};
  }, []);

  return (
    <>
      <User
        userId={25136}
        activity={activityMap.get(25136)}
        relationship={relationshipMap.get(25136)}
      ></User>
      {/* <User
        userId={72786}
        activity={activityMap.get(72786)}
        relationship={relationshipMap.get(72786)}
      ></User> */}
    </>
  );
}

export default ChatRoom;
