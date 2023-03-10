import UserBase from './UserBase';
import { memo, ReactNode } from 'react';
import { relationshipData } from '../hooks/SocketOnHooks';
import Dropdown from './Dropdown';

interface Props {
  userId: number;
  session?: boolean;
  downChild?: ReactNode;
}

function User(props: Props) {
  return (
    <UserBase
      userId={props.userId}
      downChild={props.downChild}
      session={props.session}
      rightChild={<Dropdown userId={props.userId}></Dropdown>}
    />
  );
}

export default memo(User);
