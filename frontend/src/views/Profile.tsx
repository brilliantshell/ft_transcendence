import { useParams } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useRecoilValue } from 'recoil';
import { myIdState } from '../util/Recoils';
import { socket } from '../util/Socket';
import { useCurrentUi } from '../components/hooks/CurrentUi';
import { useSocketOn } from '../components/hooks/SocketOnHooks';
import { ErrorAlert } from '../util/Alert';
import instance from '../util/Axios';
import User from '../components/User/User';
import ProfileMenuBar from '../components/Profile/MenuBar';
import Achievements from '../components/Profile/Achievements';
import LadderProgressBar from '../components/Profile/LadderProgressBar';
import WinLossTotalCounter from '../components/Profile/WinLossTotalCounter';
import MatchHistoryList from '../components/Profile/MatchHistoryList';

export interface ProfileDataForm {
  ladder: number;
  achievement: Array<{ id: number; title: string; about: string }>;
  winLossTotal: Array<number>;
  matchHistory: Array<{
    matchId: number;
    winner: { userId: number; nickname: string; isDefaultImage: boolean };
    loser: { userId: number; nickname: string; isDefaultImage: boolean };
    score: Array<number>;
    isRank: boolean;
  }>;
}

function Profile() {
  const [isConnected, setIsConnected] = useState(socket.connected);

  useCurrentUi(isConnected, setIsConnected, 'profile');
  useSocketOn();

  const { id } = useParams();
  const myId = useRecoilValue(myIdState);
  const [profileData, setProfileData] = useState<ProfileDataForm>();

  useEffect(() => {
    instance
      .get(`/profile/${id ?? myId}`)
      .then(result => {
        setProfileData(result.data);
      })
      .catch(() => {
        ErrorAlert(
          '해당 ID에 대한 프로필 로드에 실패했습니다.',
          'ID가 유효하지 않습니다.',
        );
      });
  }, [id]);

  return (
    profileData && (
      <div className="profileContainer">
        <ProfileMenuBar userId={id && myId !== Number(id) ? null : myId} />
        <div className="profileItem">
          <User userId={id ? Number(id) : myId} />
        </div>
        <Achievements achievements={profileData.achievements} />
        <LadderProgressBar ladder={profileData.ladder}></LadderProgressBar>
        <WinLossTotalCounter winLoss={profileData.winLossTotal} />
        <MatchHistoryList history={profileData.matchHistory} />
      </div>
    )
  );
}

export default Profile;
