// import MyRank from '../components/Rank/MyRank';
import RanksList from '../components/Rank/RankList';
import { socket } from '../util/Socket';
import { lazy, Suspense, useEffect } from 'react';

const MyRank = lazy(() => import('../components/Rank/MyRank'));

function Ranks() {
  useEffect(() => {
    socket.emit('currentUi', { ui: 'ranks' });
  }, []);
  return (
    <div className="ranks">
      <Suspense fallback={<div className="myRank">로딩중...</div>}>
        <MyRank />
      </Suspense>
      <RanksList />
    </div>
  );
}

export default Ranks;
