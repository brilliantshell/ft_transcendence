import instance from '../../util/Axios';
import { memo, ReactNode, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ErrorAlert } from '../../util/Alert';
import { useRecoilValue, useSetRecoilState } from 'recoil';
import {
  editProfileState,
  userActivity,
  userAtomFamily,
} from '../../util/Recoils';

interface Props {
  userId: number;
  session?: boolean;
  rightChild?: ReactNode;
  downChild?: ReactNode;
}

export interface userData {
  nickname: string;
  isDefaultImage: boolean;
}

/**
 * @description 다양한 형태의 UserComponent를 만들기 위한
 * Base가 되는 Component입니다.
 */
function UserBase(props: Props) {
  const [user, setUser] = useState<userData>({
    nickname: '',
    isDefaultImage: true,
  });

  const activityMap = useRecoilValue(userActivity);
  const editProfile = useRecoilValue(editProfileState);
  const setUserAtom = useSetRecoilState(userAtomFamily(props.userId));

  useEffect(() => {
    instance
      .get(`/user/${props.userId}/info`)
      .then(result => {
        setUser(result.data);
        setUserAtom(result.data);
        if (props.session === true) {
        }
      })
      .catch(() => {
        ErrorAlert('오류가 발생', '오류가 발생했습니다!');
      });
  }, [props.userId, editProfile]);

  return (
    <div className="userBase">
      <div className="profileDiv">
        {
          {
            online: (
              <div
                className="activityDot"
                style={{ background: 'var(--online)' }}
              />
            ),
            offline: (
              <div
                className="activityDot"
                style={{ background: 'var(--offline)' }}
              />
            ),
            inGame: (
              <div
                className="activityDot"
                style={{ background: 'var(--in_game)' }}
              />
            ),
          }[activityMap.get(props.userId)?.activity ?? 'offline']
        }
        <img
          className="profileImage"
          src={
            user?.isDefaultImage
              ? '/assets/defaultProfile.svg'
              : `/assets/profile-image/${props.userId}`
          }
        />
      </div>
      <Link to={`/profile/${props.userId}`} className="userNickname regular">
        {user.nickname}
      </Link>
      {props.rightChild && props.rightChild}
      {props.downChild && <div className="downChild">{props.downChild}</div>}
    </div>
  );
}

export default memo(UserBase);
