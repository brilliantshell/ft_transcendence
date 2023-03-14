import { useEffect, useRef, useState } from 'react';
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
  const chatListDivRef = useRef<HTMLDivElement>(null);

  const [isMoreMessage, setIsMoreMessage] = useState<boolean>(true);
  const [isClick, setIsClick] = useState<boolean>(false);
  const [currentHeight, setCurrentHeight] = useState<number>(0);

  const dataFetch = () => {
    instance
      .get(`/chats/${props.id}/message?range=${contents.length},100`)
      .then(result => {
        const arr = result.data.messages.reverse();
        setContents(prev => [...arr, ...prev]);
        if (result.data.messages.length < 100) {
          setIsMoreMessage(false);
        } else {
          setIsMoreMessage(true);
        }
      })
      .catch(() => {
        setIsMoreMessage(false);
      });
  };

  const clickHandler = () => {
    if (chatListDivRef.current) {
      setCurrentHeight(chatListDivRef.current.scrollHeight);
    }
    dataFetch();
    setIsClick(true);
  };

  useEffect(() => {
    dataFetch();
  }, []);

  useEffect(() => {
    socket.on('newMessage', (data: MessageData) => {
      setContents(prev => [...prev, data]);
    });
    return () => {
      socket.off('newMessage');
    };
  }, []);

  useEffect(() => {
    if (isClick) {
      if (chatListDivRef.current) {
        chatListDivRef.current.scrollTop =
          chatListDivRef.current.scrollHeight - currentHeight;
      }
      setIsClick(false);
      return;
    }
    if (chatListDivRef.current) {
      const { scrollHeight, clientHeight } = chatListDivRef.current;
      chatListDivRef.current.scrollTop = scrollHeight - clientHeight;
    }
  }, [contents]);

  return (
    <div className="chatList" ref={chatListDivRef}>
      {isMoreMessage && <button onClick={clickHandler}>더 보기</button>}
      {contents.map(data => (
        <Message key={data.messageId} data={data} />
      ))}
    </div>
  );
}

export default ChatList;
