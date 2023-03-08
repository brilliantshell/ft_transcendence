import instance from '../../util/Axios';
import User from '../User/User';
import { useEffect, useState, useMemo, Suspense, lazy } from 'react';
import { useSocketOn } from '../hooks/SocketOnHooks';
import { useRecoilValue } from 'recoil';
import { userActivity, userRelationship } from '../../util/Recoils';
import { ErrorAlert } from '../../util/Alert';

const RanksItem = lazy(() => import('./RanksItem'));

interface RankData {
  id: number;
  ladder: number;
  rank: number;
}

function RanksList() {
  const activityMap = useRecoilValue(userActivity);
  const relationshipMap = useRecoilValue(userRelationship);
  const [data, setData] = useState<Array<RankData>>([]);

  useSocketOn();

  useEffect(() => {
    instance
      .get('/ranks?range=0,50')
      .then(result => {
        setData(result.data.users);
      })
      .catch(() =>
        ErrorAlert('랭킹을 불러오는데 실패했습니다.', '랭킹 불러오기 실패'),
      );
  }, []);

  const rankData = useMemo(() => data, [data]);

  return (
    <div className="ranksList">
      <div className="ranksListHeader">
        <p>랭크 🏆</p>
        <p>유저 👫</p>
        <p>레벨 🏅</p>
      </div>
      <div className="ranksListBody">
        <Suspense fallback={<div>로딩중...</div>}>
          {rankData.map(({ rank, id, ladder }) => (
            <RanksItem id={id} rank={rank} ladder={ladder}>
              <User
                userId={id}
                activity={activityMap.get(id)}
                relationship={relationshipMap.get(id)}
              />
            </RanksItem>
          ))}
        </Suspense>
      </div>
    </div>
  );
}

export default RanksList;
