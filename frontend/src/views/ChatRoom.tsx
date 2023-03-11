import { useNavigate, useParams } from 'react-router-dom';
import { useEffect, useState } from 'react';
import UserList from '../components/ChatRoom/UserList';
import ChatList from '../components/ChatRoom/ChatList';
import ChatInput from '../components/ChatRoom/ChatInput';
import { useCurrentUi } from '../components/hooks/CurrentUi';
import { socket } from '../util/Socket';
import { ErrorAlert } from '../util/Alert';

function ChatRoom() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [isConnected, setIsConnected] = useState<boolean>(socket.connected);

  useCurrentUi(isConnected, setIsConnected, `chatRooms-${id}`);
  //   GET /chats/{:channelId} ⇒ 200 || 403 (Forbidden) - 맴버 정보 / 맴버가 아니면 403!
  //   GET /chats/{:channelId}/message?range=n,m ⇒ 200 || 403 - 메시지
  // POST /chats/{:channelId}/message ⇒ 201 || 403 - 메시지 전송
  //   DELETE /chats/{:channelId}/user ⇒ 204 || 403 - 나가기

  // PUT /chats/{:channelId}/user/{:userId} ⇒ 201 || 204 || 403 - 멤버 추가  -- 줄레님이 해주실 예정...!

  useEffect(() => {
    if (id === undefined || !/^[1-9]\d{0,9}$/.test(id)) {
      ErrorAlert('잘못된 접근입니다.', '채팅방을 다시 선택해주세요.');
      return navigate('/chats');
    }
  }, []);

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
        <UserList id={id ?? ''} />
      </div>
      <div className="chatRoomRight">
        <ChatList id={id ?? ''} />
        <ChatInput />
      </div>
    </div>
  );
}

export default ChatRoom;
