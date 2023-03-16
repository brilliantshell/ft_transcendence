import { useParams } from 'react-router-dom';
import { useState } from 'react';
import { socket } from '../util/Socket';
import { useCurrentUi } from '../components/hooks/CurrentUi';
import { useSocketOn } from '../components/hooks/SocketOnHooks';
import ProfileContainer from '../components/Profile/ProfileContainer';

function Profile() {
  const [isConnected, setIsConnected] = useState(socket.connected);
  const { id } = useParams();

  useCurrentUi(isConnected, setIsConnected, 'profile');
  useSocketOn();

  return isConnected ? <ProfileContainer id={id} /> : <></>;
}

export default Profile;
