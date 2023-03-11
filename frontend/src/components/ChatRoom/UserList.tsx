import { useEffect, useState } from 'react';
import instance from '../../util/Axios';
import User from '../User/User';
import { ErrorAlert } from '../../util/Alert';
import ChannelInvitationButton from './ChannelInvitationButton';
import { useRecoilValue } from 'recoil';
import { myIdState } from '../../util/Recoils';
import { useSocketOn } from '../hooks/SocketOnHooks';
import ChannelUpdateButton from './ChannelUpdateButton';

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
        {channelInfo.channelMembers.map(data => (
          <User
            key={data.id}
            userId={data.id}
            downChild={!isDm && data.role}
            session={true}
          ></User>
        ))}
      </div>
      <button>나가기</button>
      {!isDm && <ChannelInvitationButton channelId={props.id} />}
      {!isDm && myRole === 'owner' && (
        <ChannelUpdateButton channelId={props.id} />
      )}
    </>
  );
}

export default UserList;
