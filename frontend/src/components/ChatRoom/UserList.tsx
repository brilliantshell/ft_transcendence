import { useEffect, useState } from 'react';
import instance from '../../util/Axios';
import User from '../User/User';
import { ErrorAlert } from '../../util/Alert';
import InvitationButton from '../search/InvitationButton';
import { useRecoilValue } from 'recoil';
import { myIdState } from '../../util/Recoils';
import { useSocketOn } from '../hooks/SocketOnHooks';

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
  const [myRole, setMyRole] = useState<'owner' | 'admin' | 'member'>('member');
  const myId = useRecoilValue(myIdState);

  useSocketOn();
  
  useEffect(() => {
    instance
      .get(`/chats/${props.id}`)
      .then(result => {
        setChannelInfo(result.data);
        setMyRole(
          result.data.channelMembers.find(
            ({ id }: { id: number }) => id === myId,
          )?.role || 'member',
        );
      })
      .catch(err => {
        if (err.response.status === 403) {
          ErrorAlert('입장 불가한 채팅방입니다.', err.response.data.message);
        }
      });
    return () => {};
  }, []);
  
  const isDm = channelInfo.isReadonlyDm !== null;

  return (
    <>
      <div className="chatRoomUserList">
        {channelInfo.channelMembers.map((data, index) => (
          <User
            key={index}
            userId={data.id}
            downChild={!isDm && data.role}
            session={true}
          ></User>
        ))}
      </div>
      <button>나가기</button>
      {!isDm && <InvitationButton channelId={props.id} />}
      {!isDm && myRole === 'owner' && <button>방 설정</button>}
    </>
  );
}

export default UserList;
