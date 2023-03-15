import Dropdown from './Dropdown';
import UserBase from './UserBase';
import { ReactNode, memo } from 'react';

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
      rightChild={<Dropdown userId={props.userId} />}
    />
  );
}

export default memo(User);
