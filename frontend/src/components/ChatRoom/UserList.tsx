import ChannelInvitationButton from './ChannelInvitationButton';
import ChannelUpdateButton from './ChannelUpdateButton';
import instance from '../../util/Axios';
import { useEffect, useState } from 'react';
import User from '../User/User';
import { useRecoilValue } from 'recoil';
import { useSocketOn } from '../hooks/SocketOnHooks';
import { ErrorAlert } from '../../util/Alert';
import { myIdState } from '../../util/Recoils';
import { socket } from '../../util/Socket';
import { useNavigate } from 'react-router-dom';
import UserLeftButton from './UserLeftButton';

interface Props {
  id: string;
}

function UserList(props: Props) {
  const [channelMembers, setChannelMembers] = useState<
    { id: number; role: 'owner' | 'admin' | 'member' }[]
  >([]);
  const [isReadonlyDm, setIsReadonlyDm] = useState<boolean | null>(null);
  const [myRole, setMyRole] = useState<'owner' | 'admin' | 'member'>('member');
  const myId = useRecoilValue(myIdState);
  const navigate = useNavigate();

  useSocketOn();

  useEffect(() => {
    instance
      .get(`/chats/${props.id}`)
      .then(result => {
        setChannelMembers(result.data.channelMembers);
        setIsReadonlyDm(result.data.isReadonlyDm);
        setMyRole(
          result.data.channelMembers.find(
            ({ id }: { id: number }) => id === myId,
          )?.role || 'member',
        );
        socket.on('memberJoin', data => {
          setChannelMembers(prev => [
            ...prev,
            { id: data.joinedMember, role: 'member' },
          ]);
        });
        socket.on('memberLeft', data => {
          if (data.isOwner) {
            ErrorAlert(
              '방장이 채팅방을 나갔습니다.',
              '채팅방이 삭제되었습니다',
            );
            navigate('/chats');
          }
          if (myId === data.leftMember) {
            navigate('/chats');
          }
          setChannelMembers(prev =>
            prev.filter(member => member.id !== data.leftMember),
          );
        });
        socket.on('roleChanged', data => {
          setChannelMembers(prev => {
            const index = prev.findIndex(
              member => member.id === data.changedMember,
            );
            prev[index].role = data.newRole;
            return [...prev];
          });
        });
      })
      .catch(err => {
        if (err.response.status === 403) {
          ErrorAlert('입장 불가한 채팅방입니다.', '권한이 없는 유저입니다.');
          navigate('/chats');
        }
      });

    return () => {
      socket.off('memberJoin');
      socket.off('memberLeft');
      socket.off('roleChanged');
    };
  }, [props.id]);

  const isDm = isReadonlyDm !== null;

  return (
    <div className="chatRoomLeft">
      <div className="chatRoomUserList">
        <div className="chatRoomUser">
          {channelMembers.map(data => (
            <User
              key={data.id}
              userId={data.id}
              downChild={!isDm && data.role}
              session={true}
            ></User>
          ))}
        </div>
      </div>

      <UserLeftButton id={props.id} />

      {!isDm && <ChannelInvitationButton channelId={props.id} />}
      {!isDm && myRole === 'owner' && (
        <ChannelUpdateButton channelId={props.id} />
      )}
    </div>
  );
}

export default UserList;
