import { useEffect, useRef } from 'react';
import { ErrorAlert, InfoAlert } from '../../util/Alert';
import instance from '../../util/Axios';

interface Props {
  id: string;
}

function ChatInput(props: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current && inputRef.current.focus();
  }, []);

  const sendMessage = () => {
    if (!inputRef.current) {
      return;
    }
    const message = inputRef.current.value;
    inputRef.current.value = '';
    if (message === '') {
      return;
    }
    if (message === '/help') {
      InfoAlert(
        '명령어 목록',
        '<div class=xlarge>*역할 변경*</div>' +
          '/role nickname admin<br/>' +
          '/role nickname member<br/><br/>' +
          '<div class=xlarge>*벤 하기*</div>/ban nickname [min]<br/><br/>' +
          '<div class=xlarge>*입막기*</div>/mute nickname [min]<br/><br/>' +
          '<div class=xlarge>*강퇴하기*</div>' +
          '<div class=large>(엄청나게 긴 시간입니다. 신중히...)</div>/kick nickname',
      );
      return;
    }
    instance
      .post(`/chats/${props.id}/message`, { message: message })
      .catch(err => {
        if (err.response.status === 400) {
          ErrorAlert('잘못된 명령어입니다.', '/help로 명령어를 확인하세요.');
        } else if (err.response.status === 403) {
          // console.error(err.response.data.message);
          let alertMessage = '';
          if (
            err.response.data.message === 'This user is banned from the channel'
          ) {
            alertMessage = '이 채팅방에서 차단된 상태입니다.';
          } else if (
            err.response.data.message ===
            'This user is not a member of the channel'
          ) {
            alertMessage = '이 채팅방의 멤버가 아닙니다.';
          } else if (
            err.response.data.message === 'Cannot send message to this user'
          ) {
            alertMessage =
              '해당 사용자에게 메시지를 보낼 수 있는 관계인지 확인하세요.';
          } else if (
            err.response.data.message === "You don't have permission to do this"
          ) {
            alertMessage =
              '이 채팅방에서 명령어를 사용할 수 있는 권한이 없습니다.';
          } else {
            const time = err.response.data.message.match(/(\d+)/)[0];
            alertMessage = `입력 제한 시간 ${time}분 남았습니다.`;
          }
          ErrorAlert('메시지를 보낼 수 없습니다.', alertMessage);
        } else if (err.response.status === 404) {
          ErrorAlert('존재하지 않는 유저 입니다.', '유저 닉네임을 확인하세요.');
        }
      });
  };

  return (
    <div>
      <input
        className="chatRoomInput"
        ref={inputRef}
        autoFocus={true}
        onKeyDown={e => {
          if (e.nativeEvent.isComposing) {
            return;
          }
          if (e.key === 'Enter') {
            e.preventDefault();
            sendMessage();
          }
        }}
      ></input>
      <button className="chatRoomInputButton" onClick={sendMessage}>
        전송
      </button>
    </div>
  );
}

export default ChatInput;
