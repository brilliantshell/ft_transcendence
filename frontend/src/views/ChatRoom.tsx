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
import UserList from '../components/ChatRoom/UserList';
import ChatList from '../components/ChatRoom/ChatList';
import ChatInput from '../components/ChatRoom/ChatInput';

function ChatRoom() {
  const { id } = useParams();
  const activityMap = useRecoilValue(userActivity);
  const relationshipMap = useRecoilValue(userRelationship);

  //   GET /chats/{:channelId} ⇒ 200 || 403 (Forbidden) - 맴버 정보 / 맴버가 아니면 403!
  //   GET /chats/{:channelId}/message?range=n,m ⇒ 200 || 403 - 메시지
  // POST /chats/{:channelId}/message ⇒ 201 || 403 - 메시지 전송
  //   DELETE /chats/{:channelId}/user ⇒ 204 || 403 - 나가기

  // PUT /chats/{:channelId}/user/{:userId} ⇒ 201 || 204 || 403 - 멤버 추가  -- 줄레님이 해주실 예정...!

  useSocketOn();
  useEffect(() => {
    return () => {
      const myXId = sessionStorage.getItem('x-user-id');
      sessionStorage.clear();
      sessionStorage.setItem('x-user-id', myXId?.toString() ?? '');
    };
  }, []);

  return (
    <div className="chatRoom">
      <div>
        <UserList id={id ?? ''}></UserList>
        <button>나가기</button>
        <button>맴버 추가</button>
      </div>
      <div className="chatRoomRight">
        <ChatList id={id ?? ''}></ChatList>
        <ChatInput></ChatInput>
      </div>
    </div>
  );
}

export default ChatRoom;
