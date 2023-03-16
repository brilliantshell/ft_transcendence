import { useNavigate } from 'react-router-dom';
import { ConfirmAlert, ErrorAlert } from '../../util/Alert';
import instance from '../../util/Axios';

interface Props {
  id: string;
}

function UserLeftButton(props: Props) {
  const navigate = useNavigate();

  const onClick = () => {
    ConfirmAlert(
      '정말 나가시겠습니까?',
      '확인을 누르면 채널에서 나가집니다.',
    ).then(({ isConfirmed }) => {
      isConfirmed &&
        instance
          .delete(`/chats/${props.id}/user`)
          .then(() => {
            navigate('/chats');
          })
          .catch(err => {
            if (err.response.status === 403) {
              ErrorAlert('맴버가 아닙니다.', '꺼지십시오.');
              navigate('/chats');
            }
          });
    });
  };

  return (
    <button className="chatRoomButton" onClick={onClick}>
      나가기
    </button>
  );
}

export default UserLeftButton;
