import instance from '../util/Axios';
import { ReactNode, useEffect, useState } from 'react';
import socket from '../util/Socket';
import '../style/UserBase.css';
import { Link } from 'react-router-dom';

interface Props {
  userId: number;
  nickname?: string;
  isDefaultImage?: boolean;
  online: boolean;
  rightChild?: ReactNode;
  downChild?: ReactNode;
}

/**
 * @description 다양한 형태의 UserComponent를 만들기 위한
 * Base가 되는 Component입니다.
 */
function UserBase(props: Props) {
  useEffect(() => {}, []);

  // TODO : user?.isDefault 체크하는 걸로 수정

  return (
    <div className="userBase">
      <div className="profileDiv">
        {/* TODO : 로그인 시 Lime */}
        <div style={{ background: 'DarkSlateGray' }} />
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
        {props.nickname}
      </Link>
      {props.rightChild && <div className="rightChild">{props.rightChild}</div>}
      {props.downChild && <div className="downChild">{props.downChild}</div>}
    </div>
  );
}

export default UserBase;
