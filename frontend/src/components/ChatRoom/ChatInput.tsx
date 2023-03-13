import { useEffect, useRef } from 'react';
import { ErrorAlert } from '../../util/Alert';
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
      ErrorAlert(
        '명령어 목록',
        '역할 변경<br>/role nickname admin<br/>' +
          '/role nickname member<br/>' +
          '벤 하기<br/>/ban nickname [min]<br/>' +
          '입막기<br/>/mute nickname [min]<br/>' +
          '강퇴하기(엄청나게 긴 시간입니다. 신중히...)<br/>/kick nickname',
      );
      return;
    }
    instance
      .post(`/chats/${props.id}/message`, { message: message })
      .catch(err => {
        if (err.response.status === 400) {
          ErrorAlert('잘못된 명령어입니다.', '/help로 명령어를 확인하세요.');
        } else if (err.response.status === 403) {
          ErrorAlert('권한이 없는 유저입니다.', err.response.data.message);
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
