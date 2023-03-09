import { useEffect, useState } from 'react';
import instance from '../../util/Axios';
import User from '../User/User';
import { ErrorAlert } from '../../util/Alert';

interface Props {
  id: string;
}

// isReadonlyDm : ??
// true일 때 읽기만 가능한 DM
// false : DM인데 가능
// null : 단톡
// socket on roleChanged
// memberJoin
// memberLeft
// 이벤트 발생 시 channelMembers 업데이트

function UserList(props: Props) {
  const [channelInfo, setChannelInfo] = useState<{
    channelMembers: { id: number; role: 'owner' | 'admin' | 'member' }[];
    isReadonlyDm: boolean | null;
  }>({
    channelMembers: [],
    isReadonlyDm: null,
  });

  useEffect(() => {
    instance
      .get(`/chats/${props.id}`)
      .then(result => {
        setChannelInfo(result.data);
      })
      .catch(err => {
        if (err.response.status === 403) {
          ErrorAlert('입장 불가한 채팅방입니다.', err.response.data.message);
        }
      });
    return () => {};
  }, []);

  return (
    <div className="chatRoomUserList">
      {channelInfo.channelMembers.map((data, index) => (
        <User
          key={index}
          userId={data.id}
          downChild={channelInfo.isReadonlyDm === null && data.role}
          session={true}
        ></User>
      ))}
    </div>
  );
}

export default UserList;
