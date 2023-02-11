import instance from '../api/Axios';
import { ReactNode, useEffect, useState } from 'react';
import '../style/UserBase.css';

interface User {
  nickname: string;
  profileImage: string | null;
}

interface Props {
  userId: number;
  rightChild?: ReactNode;
  downChild?: ReactNode;
}

/**
 * @description 다양한 형태의 UserComponent를 만들기 위한
 * Base가 되는 Component입니다.
 */
function UserBase(props: Props) {
  // TODO : active status를 체크하는 부분
  const [user, setUser] = useState<User>();

  useEffect(() => {
    instance
      .get('/user/668/info')
      .then(result => {
        setUser(result.data);
      })
      .catch(() => {
        console.error('axios get error');
      });
  }, []);

  const imgSrc = user?.profileImage ?? '/assets/defaultProfile';

  return (
    <div className="userBase">
      {/* <img className="profileImage" src={imgSrc} /> */}
      {/* user?.profileImage === null 일 때 (지워질 예정)*/}
      <div className="profileDiv">
        <div />
        <img className="profileImage" src="/assets/defaultProfile" />
      </div>
      <div className="userNickname">
        {/* 4~10글자 */}
        {/* {user?.nickname} */}
        1234512345
      </div>
      {props.rightChild && <div className="rightChild">{props.rightChild}</div>}
      {props.downChild && <div className="downChild">{props.downChild}</div>}
    </div>
  );
}

export default UserBase;
