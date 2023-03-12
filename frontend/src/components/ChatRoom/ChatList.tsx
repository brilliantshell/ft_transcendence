import { useEffect, useState } from 'react';
import { ErrorAlert } from '../../util/Alert';
import { listenOnce, socket } from '../../util/Socket';
import instance from '../../util/Axios';
import Message from './Message';

//   GET /chats/{:channelId}/message?range=n,m ⇒ 200 || 403 - 메시지
// TODO : 스크롤이 끝으로 갔을 때 데이터 추가로 get
// socket on newMessage

interface Props {
  id: string;
}

interface MessageData {
  senderId: number;
  contents: string;
  createdAt: number;
}

function ChatList(props: Props) {
  const [contents, setContents] = useState<MessageData[]>([]);

  useEffect(
    () => {
      instance
        .get(`/chats/${props.id}/message?range=0,20`)
        .then(result => {
          setContents(result.data.messages);
        })
        .catch(err => {
          if (err.response.status === 403) {
            ErrorAlert('입장 불가한 채팅방입니다.', err.response.data.message);
          }
        });
    },
    [
      // 스크롤 끝으로 갔을 때의 상태 넣을 예정
    ],
  );

  useEffect(() => {
    listenOnce<MessageData>('newMessage').then(data => {
      console.log(data);
      setContents(contents => [...contents, data]);
    });

    return () => {
      socket.off('newMessage');
    };
  }, []);

  return (
    <div className="chatList">
      {contents.reverse().map((data, index) => (
        // {myId === data.senderId && <div>hhh</div>}
        // 만약에 년월일이 다르면 년월일 출력!
        // message 컴포넌트로!

        <Message key={index} data={data} />
        // 배열의 순서가 바뀌거나 index가 바뀌는게 아닐때는 index를 써도 괜찮다.
      ))}
    </div>
  );
}

export default ChatList;
