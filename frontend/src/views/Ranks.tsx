import MyRank from '../components/MyRank';
import RankList from '../components/RankList';
import socket from '../util/Socket';
import { useRecoilValueLoadable } from 'recoil';
import { useEffect } from 'react';
import { myIdState } from '../util/Recoils';

function Ranks() {
  const myIdLoadable = useRecoilValueLoadable(myIdState);

  if (myIdLoadable.state === 'hasValue') {
    // FIXME : CORS 문제
    // socket.emit('currentUi', { userId: myIdLoadable.contents, ui: 'ranks' });
  }
  useEffect(() => {}, []);
  return (
    <>
      <MyRank />
      <RankList />
    </>
  );
}

export default Ranks;
