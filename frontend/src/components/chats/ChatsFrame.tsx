import '../../style/Chats.css';
import ChannelCreate from './ChannelCreate';

interface ChatsBaseProps {
  purpose: string;
  children: React.ReactNode;
}

function ChatsFrame({ purpose, children }: ChatsBaseProps) {
  return (
    <div className={`chatsFrame ${purpose}`}>
      <div className="chatsHeader">
        {purpose === 'chatsJoined' ? (
          <span>내가 참여한 채널 </span>
        ) : (
          <>
            <span>전체 채널 </span>
            <ChannelCreate />
          </>
        )}
      </div>
      {children}
    </div>
  );
}

export default ChatsFrame;
