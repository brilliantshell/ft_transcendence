import instance from '../util/Axios';
import { useEffect, useState } from 'react';
import UserBase from './UserBase';
import { useRecoilValue } from 'recoil';
import { myIdState } from '../util/Recoils';
import '../style/Ranks.css';
// TODO : 글씨 크기
function MyRank() {
  const [data, setData] = useState<{ myRank: number; total: number }>();
  const myId = useRecoilValue(myIdState);

  useEffect(() => {
    instance
      .get('/ranks/my-rank')
      .then(result => {
        setData(result.data);
      })
      .catch(reason => {
        console.error(reason);
      });
  }, []);
  return (
    <>
      <div className="myRank">
        당신은 <b>{data?.total}</b>명 중에 <b>{data?.myRank}</b>등 입니다.
      </div>
    </>
  );
}

export default MyRank;
