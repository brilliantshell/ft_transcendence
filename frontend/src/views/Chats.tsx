import { useRecoilValue } from 'recoil';
import { useEffect, useState } from 'react';
import { AxiosError } from 'axios';

import { myIdState } from '../util/Recoils';
import ChatsAll from '../components/chats/ChatsAll';
import ChatsJoined from '../components/chats/ChatsJoined';
import instance from '../util/Axios';
import socket from '../util/Socket';
import { Channels } from '../components/chats/interface';
import '../style/Chats.css';

function Chats() {
  const myId = useRecoilValue(myIdState);
  const [channels, setChannels] = useState<Channels>({
    joinedChannels: [],
    otherChannels: [],
  });
  const [error, setError] = useState<string>('');

  useEffect(() => {
    socket.emit('currentUi', { ui: 'chats' });
    (async () => {
      try {
        setChannels((await instance.get<Channels>('/chats')).data);
      } catch (err: any) {
        console.log(err);
      }
    })();
  }, []);

  return (
    <>
      <div className="chats">
        <ChatsJoined joinedChannels={channels.joinedChannels} />
        <ChatsAll otherChannels={channels.otherChannels} />
      </div>
    </>
  );
}

export default Chats;
