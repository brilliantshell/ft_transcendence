import RanksList from '../components/Rank/RanksList';
import { socket } from '../util/Socket';
import { lazy, Suspense, useState } from 'react';
import { useCurrentUi } from '../components/hooks/EmitCurrentUi';
import { MyRankInfo } from '../components/Rank/interface';

const MyRank = lazy(() => import('../components/Rank/MyRank'));

function Ranks() {
  const [isConnected, setIsConnected] = useState(socket.connected);
  const [myRankInfo, setMyRankInfo] = useState<MyRankInfo>({
    myRank: 0,
    limit: 50,
  });

  useCurrentUi(isConnected, setIsConnected, 'ranks');

  return (
    <div className="ranks">
      <Suspense
        fallback={
          <div className="myRank">
            <div className="ranksSpin spinBig"></div>
          </div>
        }
      >
        <MyRank myRankInfo={myRankInfo} setMyRankInfo={setMyRankInfo} />
      </Suspense>
      <RanksList setMyRankInfo={setMyRankInfo} />
    </div>
  );
}

export default Ranks;
