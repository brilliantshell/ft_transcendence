import { useEffect, useState } from 'react';
import instance from '../../util/Axios';
import { useRecoilValue } from 'recoil';
import { myIdState } from '../../util/Recoils';
import { ErrorAlert } from '../../util/Alert';
import { MyRankInfo } from './interface';

interface UserData {
  nickname: string;
  imageSrc: string;
}

interface MyRankProps {
  myRankInfo: MyRankInfo;
  setMyRankInfo: React.Dispatch<React.SetStateAction<MyRankInfo>>;
}

function MyRank({ myRankInfo, setMyRankInfo }: MyRankProps) {
  const [rankTotal, setRankTotal] = useState<number>(0);
  const [userData, setUserData] = useState<UserData>({
    nickname: '',
    imageSrc: '',
  });
  const myId = useRecoilValue(myIdState);
  const { myRank, limit } = myRankInfo;

  useEffect(() => {
    Promise.all([
      instance
        .get('/ranks/my-rank')
        .then(({ data }) => {
          setRankTotal(data.total);
          setMyRankInfo({ myRank: data.myRank, limit: limit });
        })
        .catch(() =>
          ErrorAlert(
            '본인의 랭킹을 불러오는데 실패했습니다.',
            '오류가 발생했습니다.',
          ),
        ),
      instance
        .get(`/user/${myId}/info`)
        .then(({ data }) =>
          setUserData({
            nickname: data.nickname,
            imageSrc: '/assets/defaultProfile.svg',
            // FIXME: imageSrc: data.isDefaultImage
            //   ? '/assets/defaultProfile.svg'
            //   : `http://localhost:3000/asset/profile-image/${myId}`,
          }),
        )
        .catch(() =>
          ErrorAlert(
            '본인의 정보를 불러오는데 실패했습니다.',
            '오류가 발생했습니다.',
          ),
        ),
    ]);
  }, []);

  return (
    <div className="myRank">
      <img
        className="myRankProfileImg selectNone"
        src={userData.imageSrc}
        alt="profile image"
      />
      <p className="myRankNickname xxlarge selectNone">{userData.nickname}</p>
      <p className="myRankDetail">
        당신은 {rankTotal} 명 중
        {myRank < limit
          ? `에 ${myRank} 등 입니다.`
          : ` ${limit} 위 안에 들지 못했습니다!`}
      </p>
    </div>
  );
}

export default MyRank;
