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

  useCurrentUi(isConnected, setIsConnected, `chatRooms-${id}`, [id]);

  useEffect(() => {
    if (id === undefined || !/^[1-9]\d{0,9}$/.test(id)) {
      ErrorAlert('잘못된 접근입니다.', '채팅방을 다시 선택해주세요.');
      return navigate('/chats');
    }
    return () => {};
  }, [id]);

  return (
    <div className="chatRoom">
      <div>{isConnected && <UserList id={id ?? ''} />}</div>
      <div className="chatRoomRight">
        <ChatList id={id ?? ''} />
        <ChatInput id={id ?? ''} />
      </div>
    </div>
  );
}

export default ChatRoom;
