import { useEffect, useState } from 'react';
import { useRecoilValue } from 'recoil';
import { ErrorAlert } from '../../util/Alert';
import instance from '../../util/Axios';
import { myIdState } from '../../util/Recoils';
import Message from './Message';

//   GET /chats/{:channelId}/message?range=n,m ⇒ 200 || 403 - 메시지
// TODO : 스크롤이 끝으로 갔을 때 데이터 추가로 get
// socket on newMessage

interface Props {
  id: string;
}

function ChatList(props: Props) {
  const myId = useRecoilValue(myIdState);

  const [contents, setContents] = useState<
    {
      senderId: number;
      contents: string;
      createdAt: number;
    }[]
  >([]);

  //

  useEffect(() => {
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

    return () => {};
  }, []);

  return (
    <div className="chatList">
      {contents.map((data, index) => (
        // {myId === data.senderId && <div>hhh</div>}
        // 만약에 년월일이 다르면 년월일 출력!
        // message 컴포넌트로!

        <Message key={index} data={data}></Message>
      ))}
    </div>
  );
}

export default ChatList;
