import instance from '../../util/Axios';
import { memo, ReactNode, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ErrorAlert } from '../../util/Alert';
import { useRecoilValue } from 'recoil';
import { userActivity } from '../../util/Recoils';

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

  useEffect(() => {
    instance
      .get(`/user/${props.userId}/info`)
      .then(result => {
        setUser(result.data);
        if (props.session === true) {
          sessionStorage.setItem(
            props.userId.toString(),
            JSON.stringify(result.data),
          );
        }
      })
      .catch(() => {
        ErrorAlert('오류가 발생', '오류가 발생했습니다!');
      });
  }, [props.userId]);

  const onlineFunc = () => {
    if (!activityMap.get(props.userId)) return false;
    return activityMap.get(props.userId)?.activity !== 'offline';
  };

  // TODO : user?.isDefault 체크하는 걸로 수정

  return (
    <div className="userBase">
      <div className="profileDiv">
        {onlineFunc() ? (
          <div style={{ background: 'var(--online)' }} />
        ) : (
          <div style={{ background: 'var(--offline)' }} />
        )}
        {/* <img
          className="profileImage"
          src={
            user?.isDefaultImage
              ? '/assets/defaultProfile'
              : '`localhost:3000/asset/profileImages/${props.userId}`'
          }
        /> */}
        <img className="profileImage" src="/assets/defaultProfile.svg" />
      </div>
      <Link to={`/profile/${props.userId}`} className="userNickname">
        {user.nickname}
      </Link>
      {props.rightChild && <div className="rightChild">{props.rightChild}</div>}
      {props.downChild && <div className="downChild">{props.downChild}</div>}
    </div>
  );
}

export default memo(UserBase);
