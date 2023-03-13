interface ChatsBaseProps {
  purpose: string;
  children: React.ReactNode;
}

function ChatsFrame({ purpose, children }: ChatsBaseProps) {
  return (
    <div className={`chatsFrame ${purpose}`}>
      <div className="chatsHeader xlarge">
        {purpose === 'chatsJoined' ? (
          <h1>참여한 채널 </h1>
        ) : (
          <>
            <h1>전체 채널 </h1>
          </>
        )}
      </div>
      {children}
    </div>
  );
}

export default ChatsFrame;
