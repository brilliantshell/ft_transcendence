import instance from '../../util/Axios';
import { ReactNode, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useSocketOn } from '../hooks/SocketOnHooks';

interface Props {
  userId: number;
  online: boolean;
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

  useEffect(() => {
    instance
      .get(`/user/${props.userId}/info`)
      .then(result => {
        setUser(result.data);
      })
      .catch(reason => {
        console.error(reason);
      });
  }, []);

  // TODO : user?.isDefault 체크하는 걸로 수정

  return (
    <div className="userBase">
      <div className="profileDiv">
        {props.online ? (
          <div style={{ background: 'Lime' }} />
        ) : (
          <div style={{ background: 'DarkSlateGray' }} />
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

export default UserBase;
