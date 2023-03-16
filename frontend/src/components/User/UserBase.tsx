import instance from '../../util/Axios';
import { memo, ReactNode, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ErrorAlert } from '../../util/Alert';
import { useRecoilValue } from 'recoil';
import { editProfileState, userActivity } from '../../util/Recoils';

interface Props {
  userId: number;
  session?: boolean;
  rightChild?: ReactNode;
  downChild?: ReactNode;
}

interface userData {
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

  useEffect(() => {
    instance
      .get(`/user/${props.userId}/info`)
      .then(result => {
        setUser(result.data);
        if (props.session === true) {
          console.log('aaaaa');
          sessionStorage.setItem(
            props.userId.toString(),
            JSON.stringify(result.data),
          );
        }
      })
      .catch(() => {
        ErrorAlert('오류가 발생', '오류가 발생했습니다!');
      });
  }, [props.userId, editProfile]);

  const onlineFunc = () => {
    if (!activityMap.get(props.userId)) return false;
    return activityMap.get(props.userId)?.activity !== 'offline';
  };

  return (
    <div className="userBase">
      <div className="profileDiv">
        {onlineFunc() ? (
          <div
            className="activityDot"
            style={{ background: 'var(--online)' }}
          />
        ) : (
          <div
            className="activityDot"
            style={{ background: 'var(--offline)' }}
          />
        )}
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
