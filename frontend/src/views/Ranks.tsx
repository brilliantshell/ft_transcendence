// import MyRank from '../components/Rank/MyRank';
import RanksList from '../components/Rank/RanksList';
import { socket } from '../util/Socket';
import { lazy, Suspense, useState } from 'react';
import { useCurrentUi } from '../components/hooks/EmitCurrentUi';

const MyRank = lazy(() => import('../components/Rank/MyRank'));

function Ranks() {
  const [isConnected, setIsConnected] = useState(socket.connected);

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
        <MyRank />
      </Suspense>
      <RanksList />
    </div>
  );
}

export default Ranks;
