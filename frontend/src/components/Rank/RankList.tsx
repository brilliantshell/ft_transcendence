import instance from '../../util/Axios';
import User from '../User/User';
import { useEffect, useState, useMemo } from 'react';
import { socket } from '../../util/Socket';
import { useSocketOn } from '../hooks/SocketOnHooks';
import { useRecoilValue } from 'recoil';
import { userActivity, userRelationship } from '../../util/Recoils';

// TODO : 우선 TOP50으로 하고 이후에 수정할 지 고민
// TODO : websocket 순위 변동 적용 예정

function RankList() {
  const columns = ['Rank', 'User', 'Level'];
  const activityMap = useRecoilValue(userActivity);
  const relationshipMap = useRecoilValue(userRelationship);

  const [data, setData] = useState<
    Array<{ id: number; ladder: number; rank: number }>
  >([]);

  useSocketOn();

  useEffect(() => {
    instance
      .get('/ranks?range=0,50')
      .then(result => {
        setData(result.data.users);
      })
      .catch(reason => {
        // TODO : 실패 시 코드 수정 예정
        console.error(reason);
        console.error('axios get error /ranks?range=n,m');
      });
  }, []);
  const rankData = useMemo(() => data, [data]);

  return (
    <table>
      <thead>
        <tr>
          {columns.map(column => (
            <th key={column}>{column}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rankData.map(({ rank, id, ladder }) => (
          <tr key={id}>
            <td>{rank}</td>
            <td>
              <User
                userId={id}
                activity={activityMap.get(id)}
                relationship={relationshipMap.get(id)}
              />
            </td>
            <td>{ladder}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default RankList;
