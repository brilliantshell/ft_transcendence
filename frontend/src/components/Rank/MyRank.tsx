import instance from '../../util/Axios';
import { Suspense, useEffect, useState } from 'react';
import { useRecoilValue } from 'recoil';
import { myIdState } from '../../util/Recoils';
import { ErrorAlert } from '../../util/Alert';

function MyRank() {
  const [rankData, setRankData] = useState<{ myRank: number; total: number }>({
    myRank: 0,
    total: 0,
  });
  const [userData, setUserData] = useState<{
    nickname: string;
    imageSrc: string;
  }>({ nickname: '', imageSrc: '' });
  const myId = useRecoilValue(myIdState);

  useEffect(() => {
    Promise.all([
      instance
        .get('/ranks/my-rank')
        .then(result => {
          setRankData(result.data);
        })
        .catch(() => ErrorAlert('랭킹에서 ', '암튼 에러가 났답니다~')),
      instance
        .get(`/user/${myId}/info`)
        .then(result => {
          const data = result.data;
          setUserData({
            nickname: data.nickname,
            imageSrc: '/assets/defaultProfile.svg',
            // FIXME: imageSrc: data.isDefaultImage
            //   ? '/assets/defaultProfile.svg'
            //   : `http://localhost:3000/asset/profile-image/${myId}`,
          });
        })
        .catch(err =>
          ErrorAlert(
            '당신의 정보를 불러오는데 실패했습니다.',
            '당신의 정보 불러오기 실패' + err.response.data.message,
          ),
        ),
    ]);
  }, []);

  useEffect(() => {}, []);

  return (
    <div className="myRank">
      <img
        className="myRankProfileImg"
        src={userData.imageSrc}
        alt="profile image"
      />
      <p className="myRankNickname xxlarge">{userData.nickname}</p>
      <p className="myRankDetail">
        당신은 {rankData.total} 명 중에 {rankData.myRank} 등 입니다.
      </p>
    </div>
  );
}

export default MyRank;
