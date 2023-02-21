import instance from '../util/Axios';
import { useEffect, useState } from 'react';
import UserBase from './UserBase';
import '../style/Ranks.css';

// TODO : myRank div 위치 조정

function MyRank() {
  const [data, setData] = useState<{ myRank: number; total: number }>();
  useEffect(() => {
    instance
      .get('/ranks/my-rank')
      .then(result => {
        setData(result.data);
      })
      .catch(() => {
        console.error('axios get error /ranks/my-rank');
      });
  }, []);
  return (
    <>
      <UserBase userId={47281}></UserBase>
      <div className="myRank">
        당신은 <b>{data?.total}</b>명 중에 <b>{data?.myRank}</b>등 입니다.
      </div>
    </>
  );
}

export default MyRank;
