import instance from '../util/Axios';
import { ReactNode, useEffect, useState } from 'react';
import socket from '../util/Socket';
import '../style/UserBase.css';

interface User {
  nickname: string;
  isDefaultImage: boolean;
}

interface Props {
  userId: number;
  rightChild?: ReactNode;
  downChild?: ReactNode;
}
/**
 * 리렌더링이 되는 경우
 * props가 변하는 경우
 * 근데 만약 userID는 그대로 이지만
 * nickname이 변하거나 UserImage가 변하는 경우는?
 * 이걸 처리하려면 Props로 해당 값들을 가지고 와야한다.
 *
 * => 처리를 하지 않으면
 * 그냥 부모 컴포넌트가 변하면 UserBase가 계속 리렌더링
 * 부모 컴포넌트가 랜더링 되는 경우 state가 변하는 등
 * 친구 리스트인 경우
 * 버튼을 누른 경우에 유저 컴포넌트들이 리렌더링
 */

/**
 * @description 다양한 형태의 UserComponent를 만들기 위한
 * Base가 되는 Component입니다.
 */
function UserBase(props: Props) {
  // TODO : active status를 체크하는 부분
  const [user, setUser] = useState<User>();

  useEffect(() => {
    // Promise.all([
    //   new Promise((resolve) => socket.on('userActivity', (data) => {resolve(data)})).then((data) => {}),
    instance
      .get(`/user/${props.userId}/info`)
      .then(result => {
        setUser(result.data);
      })
      .catch(() => {
        console.error('axios get error');
      });
  }, []);

  // TODO : user?.isDefault 체크하는 걸로 수정

  return (
    <div className="userBase">
      <div className="profileDiv">
        <div style={{ background: 'DarkSlateGray' }} />
        {/* TODO : 로그인 시 Lime */}
        {/* <img
          className="profileImage"
          src={
            user?.isDefaultImage
              ? '/assets/defaultProfile'
              : '`localhost:3000/asset/profileImages/${props.userId}`'
          }
        /> */}
        <img className="profileImage" src="/assets/defaultProfile" />
      </div>
      <div className="userNickname">{user?.nickname}</div>
      {props.rightChild && <div className="rightChild">{props.rightChild}</div>}
      {props.downChild && <div className="downChild">{props.downChild}</div>}
    </div>
  );
}

export default UserBase;
