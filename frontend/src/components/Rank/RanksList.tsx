import { useEffect, useState, useMemo, Suspense, lazy } from 'react';
import { useRecoilValue } from 'recoil';
import instance from '../../util/Axios';
import User from '../User/User';
import { useSocketOn } from '../hooks/SocketOnHooks';
import { myIdState, userActivity, userRelationship } from '../../util/Recoils';
import { ErrorAlert } from '../../util/Alert';
import { MyRankInfo, RankData } from './interface';
import { useUpdateMyRank, useUpdateRank } from './hooks/UpdateRank';

const RanksItem = lazy(() => import('./RanksItem'));

interface RanksListProps {
  setMyRankInfo: React.Dispatch<React.SetStateAction<MyRankInfo>>;
}

function RanksList({ setMyRankInfo }: RanksListProps) {
  const myId = useRecoilValue(myIdState);
  const activityMap = useRecoilValue(userActivity);
  const relationshipMap = useRecoilValue(userRelationship);
  const [rankData, setRankData] = useState<Array<RankData>>([]);
  const [isEmpty, setIsEmpty] = useState(false);

  useSocketOn();
  useEffect(() => {
    instance
      .get('/ranks?range=0,50')
      .then(({ data }) => setRankData(data.users))
      .catch(err => {
        err.response.status === 404
          ? setIsEmpty(true)
          : ErrorAlert(
              '랭킹을 불러오는데 실패했습니다.',
              '오류가 발생했습니다.',
            );
      });
  }, []);

  useUpdateRank(setRankData);
  useUpdateMyRank(setMyRankInfo, myId, rankData)

  const rankDataMemo = useMemo(() => rankData, [rankData]);

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
            : rankDataMemo.map(({ rank, id, ladder }, i) => (
                <RanksItem
                  key={`rank-${id}`}
                  id={id}
                  rank={rank}
                  ladder={ladder}
                >
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
