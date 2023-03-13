import { useEffect, useState } from 'react';
import { ErrorAlert } from '../../util/Alert';
import { socket } from '../../util/Socket';
import instance from '../../util/Axios';
import Message from './Message';

interface Props {
  id: string;
}

interface MessageData {
  contents: string;
  createdAt: number;
  messageId: number;
  senderId: number;
}

function ChatList(props: Props) {
  const [contents, setContents] = useState<MessageData[]>([]);

  useEffect(
    () => {
      instance
        .get(`/chats/${props.id}/message?range=0,20`)
        .then(result => {
          setContents(result.data.messages.reverse());
        })
        .catch(err => {
          if (err.response.status === 403) {
            ErrorAlert('입장 불가한 채팅방입니다.', err.response.data.message);
          }
        });
    },
    [
      // TODO :스크롤 끝으로 갔을 때의 상태 넣을 예정
    ],
  );
  useEffect(() => {
    socket.on('newMessage', (data: MessageData) => {
      setContents(prev => [...prev, data]);
      //   TODO :메시지 오면 스크롤 제일 밑으로 이동
    });

    return () => {
      socket.off('newMessage');
    };
  }, []);

  return (
    <div className="chatList">
      {contents.map(data => (
        <Message key={data.messageId} data={data} />
      ))}
    </div>
  );
}

export default ChatList;
