import User from '../components/User/User';
import { useRecoilValue } from 'recoil';
import { myIdState } from '../util/Recoils';

function Chats() {
  const myId = useRecoilValue(myIdState);

  return <User userId={25136}></User>;
}

export default Chats;
