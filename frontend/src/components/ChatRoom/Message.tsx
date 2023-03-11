import { useEffect, useState } from 'react';
import { HoverBox } from '../common/HoverBox';

interface Props {
  data: { senderId: number; contents: string; createdAt: number };
}

function Message({ data }: Props) {
  const date = new Date(data.createdAt);

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

  return (
    <div className="message">
      <img className="chatProfileImage" src="/assets/defaultProfile.svg" />
      {/* <img
          className="profileImage"
          src={
			  user?.isDefaultImage
              ? '/assets/defaultProfile'
              : '`localhost:3000/asset/profileImages/${props.userId}`'
			}
        /> */}

      <div className="messageWrap">
        <div className="messageNick">{user.nickname} </div>
        <div className="messageContents">{data.contents}</div>
      </div>
      <div className="messageTime xsmall">{date.toLocaleString()}</div>
    </div>
  );
}

export default Message;
