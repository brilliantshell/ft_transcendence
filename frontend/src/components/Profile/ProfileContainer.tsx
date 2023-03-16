import { useEffect, useState } from 'react';
import { useRecoilValue } from 'recoil';
import { ErrorAlert } from '../../util/Alert';
import instance from '../../util/Axios';
import { editProfileState, myIdState } from '../../util/Recoils';
import User from '../User/User';
import Achievements from './Achievements';
import LadderProgressBar from './LadderProgressBar';
import MatchHistoryList from './MatchHistoryList';
import ProfileMenuBar from './MenuBar';
import WinLossTotalCounter from './WinLossTotalCounter';

interface Props {
  id?: string | undefined;
}

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

function ProfileContainer({ id }: Props) {
  const myId = useRecoilValue(myIdState);
  const editProfile = useRecoilValue(editProfileState);
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
  }, [id, editProfile]);

  return (
    <div className="profileContainer">
      <ProfileMenuBar userId={id && myId !== Number(id) ? null : myId} />
      <div className="profileItem">
        <User userId={id ? Number(id) : myId} />
      </div>
      <Achievements achievements={profileData?.achievement} />
      <LadderProgressBar ladder={profileData?.ladder ?? 0}></LadderProgressBar>
      <WinLossTotalCounter winLoss={profileData?.winLossTotal} />
      <MatchHistoryList history={profileData?.matchHistory} />
    </div>
  );
}

export default ProfileContainer;
