import { useEffect, useState } from 'react';
import { useRecoilValue } from 'recoil';
import { myIdState } from '../../util/Recoils';

interface Props {
  data: { senderId: number; contents: string; createdAt: number };
}

function Message({ data }: Props) {
  const date = new Date(data.createdAt);
  const myId = useRecoilValue(myIdState);

  const [user, setUser] = useState<{
    nickname: string;
    isDefaultImage: boolean;
  }>({ nickname: '', isDefaultImage: false });

  useEffect(() => {
    const intervalId = setInterval(() => {
      if (user.nickname === '') {
        setUser(
          JSON.parse(
            sessionStorage.getItem(data.senderId.toString()) ??
              '{"nickname":"", "isDefaultImage": "false"}',
          ),
        );
        user.nickname.length && clearInterval(intervalId);
      }
    }, 200);
  }, []);

  const isMyMessage = data.senderId === myId;
  return (
    <div className={isMyMessage ? 'message myMessage' : 'message'}>
      <img
        className="chatProfileImage"
        src={
          user.isDefaultImage
            ? '/assets/defaultProfile.svg'
            : `/assets/profile-image/${data.senderId}`
        }
      />

      <div className="messageWrap">
        <div className={isMyMessage ? 'myMessageNick' : 'messageNick'}>
          {user.nickname}
        </div>
        <div className="messageContents">{data.contents}</div>
      </div>
      <div className="messageTime xsmall">{date.toLocaleString()}</div>
    </div>
  );
}

export default Message;
