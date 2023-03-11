import { useParams } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useRecoilValue } from 'recoil';
import { myIdState } from '../util/Recoils';
import { socket } from '../util/Socket';
import instance from '../util/Axios';
import User from '../components/User/User';
import ProfileMenuBar from '../components/Profile/MenuBar';
import LadderProgressBar from '../components/Profile/LadderProgressBar';
import Achievements from '../components/Profile/Achievements';
import MatchHistoryList from '../components/Profile/MatchHistoryList';
import WinLossTotalCounter from '../components/Profile/WinLossTotalCounter';
import '../style/Profile/Profile.css';

export interface profileDataForm {
  ladder: number;
  achievements: Array<{ id: number; title: string; about: string }>;
  winLossTotal: Array<number>;
  matchHistory: Array<{
    winner: string;
    loser: string;
    score: Array<number>;
    isRank: boolean;
  }>;
}

/* TODO - uri의 id가 존재하지 않는 케이스 따로 처리 */
function Profile() {
  const [isConnected, setIsConnected] = useState(socket.connected);

  useCurrentUi(isConnected, setIsConnected, 'profile');

  const { id } = useParams();
  const myId = useRecoilValue(myIdState);
  const [profileData, setProfileData] = useState<profileDataForm>();

  useEffect(() => {
    instance
      .get(`/profile/${id ?? myId}`)
      .then(result => {
        setProfileData(result.data);
      })
      .catch(reason => {
        console.log(reason);
        console.log('Failed to Load Profile Data');
        return reason;
      });
  }, [id]);

  return (
    <div className="profileContainer">
      <ProfileMenuBar userId={id && myId !== Number(id) ? null : myId} />
      <div className="profileItem">
        <User userId={id ? Number(id) : myId} />
      </div>
      <Achievements achievements={profileData?.achievements} />
      <LadderProgressBar ladder={profileData?.ladder}></LadderProgressBar>
      <WinLossTotalCounter winLoss={profileData?.winLossTotal} />
      <MatchHistoryList history={profileData?.matchHistory} />
    </div>
  );
}

export default Profile;
