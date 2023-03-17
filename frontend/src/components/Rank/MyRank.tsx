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
          setMyRankInfo({ myRank: data.myRank, limit });
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
            imageSrc: data.isDefaultImage
              ? '/assets/defaultProfile.svg'
              : `/assets/profile-image/${myId}`,
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
        당신은
        {myRank <= limit
          ? ` ${myRank} 등 입니다.`
          : ` ${limit} 위 안에 들지 못했습니다!`}
      </p>
    </div>
  );
}

export default MyRank;
