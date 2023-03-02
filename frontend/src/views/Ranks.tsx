import MyRank from '../components/Rank/MyRank';
import RankList from '../components/Rank/RankList';
import socket from '../util/Socket';
import { useEffect } from 'react';

function Ranks() {
  useEffect(() => {
    socket.emit('currentUi', { ui: 'ranks' });
  }, []);
  return (
    <>
      <MyRank />
      <RankList />
    </>
  );
}

export default Ranks;
