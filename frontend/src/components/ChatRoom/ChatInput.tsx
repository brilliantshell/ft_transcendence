// POST /chats/{:channelId}/message ⇒ 201 || 403 - 메시지 전송
// socket on 'muted'

function ChatInput() {
  // input box에 입력된 내용을 state로 관리
  //   useRef로 input box에 접근

  return <input className="chatRoomInput"></input>;
}

export default ChatInput;
