import { useEffect, useState } from 'react';
import { useRecoilValue } from 'recoil';
import { myIdState } from '../../util/Recoils';
import { userAtomFamily } from '../../util/Recoils';
interface Props {
  data: { senderId: number; contents: string; createdAt: number };
}

function Message({ data }: Props) {
  const date = new Date(data.createdAt);
  const myId = useRecoilValue(myIdState);
  const userData = useRecoilValue(userAtomFamily(data.senderId));

  useEffect(() => {}, []);

  const isMyMessage = data.senderId === myId;
  return (
    <div className={isMyMessage ? 'message myMessage' : 'message'}>
      <img
        className="chatProfileImage"
        src={
          userData.isDefaultImage
            ? '/assets/defaultProfile.svg'
            : `/assets/profile-image/${data.senderId}`
        }
      />

      <div className="messageWrap">
        <div className={isMyMessage ? 'myMessageNick' : 'messageNick'}>
          {userData.nickname}
        </div>
        <div className="messageContents">{data.contents}</div>
      </div>
      <div className="messageTime xsmall">{date.toLocaleString()}</div>
    </div>
  );
}

export default Message;
