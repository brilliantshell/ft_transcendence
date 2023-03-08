import { useEffect, useState, useMemo, Suspense, lazy } from 'react';
import { useRecoilValue } from 'recoil';
import instance from '../../util/Axios';
import User from '../User/User';
import { useSocketOn } from '../hooks/SocketOnHooks';
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
  const [isEmpty, setIsEmpty] = useState(false);

  useSocketOn();
  useEffect(() => {
    instance
      .get('/ranks?range=0,50')
      .then(({ data }) => setData(data.users))
      .catch(err => {
        err.response.status === 404
          ? setIsEmpty(true)
          : ErrorAlert(
              '랭킹을 불러오는데 실패했습니다.',
              '오류가 발생했습니다.',
            );
      });
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
        <Suspense fallback={<div className="ranksSpin spinSmall"></div>}>
          {isEmpty
            ? '랭크 데이터가 존재하지 않습니다.'
            : rankData.map(({ rank, id, ladder }) => (
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
