import instance from '../util/Axios';
import UserBase from './UserBase';
import { useEffect, useState, useMemo } from 'react';
// TODO : 우선 TOP50으로 하고 이후에 수정할 지 고민
function RankList() {
  const columns = ['Rank', 'User', 'Level'];

  const [data, setData] = useState<
    Array<{ id: number; ladder: number; rank: number }>
  >([]);
  useEffect(() => {
    instance
      .get('/ranks?range=1,50')
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
              {/* TODO :이후에 User component로 바꿀 예정 */}
              <UserBase userId={id} />
            </td>
            <td>{ladder}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default RankList;
