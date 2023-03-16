import { useEffect, useRef, useState } from 'react';
import { socket } from '../../util/Socket';
import instance from '../../util/Axios';
import Message from './Message';

const BUTTON_IMG_PATH = '/assets/arrow-up-circle.png';

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
    instance
      .get(`/chats/${props.id}/message?range=0,100`)
      .then(result => {
        const arr = result.data.messages.reverse();
        setContents(arr);
        if (result.data.messages.length < 100) {
          setIsMoreMessage(false);
        } else {
          setIsMoreMessage(true);
        }
        socket.on('newMessage', (data: MessageData) => {
          setContents(prev => [...prev, data]);
        });
      })
      .catch(() => {
        setIsMoreMessage(false);
      });
    return () => {
      setContents([]);
      socket.off('newMessage');
    };
  }, [props.id]);

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
      {isMoreMessage && (
        <button onClick={clickHandler} className="upButton">
          <img className="upButtonImage" src={BUTTON_IMG_PATH}></img>
        </button>
      )}
      {contents.map(data => (
        <Message key={data.messageId} data={data} />
      ))}
    </div>
  );
}

export default ChatList;
