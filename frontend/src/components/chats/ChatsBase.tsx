import { Children } from 'react';
import '../../style/Chats.css';

interface ChatsBaseProps {
  purpose: string;
  children: React.ReactNode;
}

function ChatsBase({
  purpose,
  children /* , headerNode, bodyNode */,
}: ChatsBaseProps) {
  return (
    <div className={purpose}>
      {children}
    </div>
  );
}

export default ChatsBase;
