import instance from '../../util/Axios';
import UserBase from './UserBase';
import { memo, useEffect, useState } from 'react';
import { useRecoilValue } from 'recoil';
import { myIdState } from '../../util/Recoils';
import { useNavigate } from 'react-router-dom';
import socket from '../../util/Socket';
import { activityData, relationshipData } from '../hooks/SocketOnHooks';

// relationship이 본인일 때는 어떤 식으로??
interface Props {
  activity?: activityData;
  relationship: relationshipData;
  userId: number;
}

function User(props: Props) {
  const myId = useRecoilValue(myIdState);
  const navigate = useNavigate();

  const gameBtnStr = ['게임 초대', '게임 관전'];
  const blockBtnStr = ['차단', '차단 해제'];
  const friendBtnStr = [
    '친구 추가',
    '친구 삭제',
    '친구 요청 취소',
    '친구 요청 중',
  ];

  const dmOnclick = () => {
    instance
      .put(`/user/${props.userId}/dm`)
      .then(result => {
        navigate(result.headers.location);
      })
      .catch(reason => {
        // 400
        console.error(reason);
      });
  };

  const blockOnclick = () => {
    instance
      .put(`/user/${props.userId}/block`)
      .then()
      .catch(reason => {
        // 403
        console.error(reason);
      });
  };

  const blockDeleteOnclick = () => {
    instance
      .delete(`/user/${props.userId}/block`)
      .then()
      .catch(reason => {
        // 403
        console.error(reason);
      });
  };

  useEffect(() => {}, []);

  const onlineFunc = () => {
    if (props.activity === undefined) {
      return false;
    }
    if (props.activity?.activity === 'offline') {
      return false;
    }
    return true;
  };

  return (
    <>
      <UserBase
        userId={props.userId}
        online={onlineFunc()}
        rightChild={
          <div className="dropdown">
            <img className="dropdownImage" src="/assets/dropdown.svg" />
            <div className="dropdown-content">
              {props.userId === myId ? (
                <div> 본인입니다!!!!!! </div>
              ) : (
                <>
                  <button onClick={dmOnclick}>DM</button>
                  {/* 
friend: 친구
- 친구 삭제 버튼
- 차단버튼이 있어야하나?

pendingSender: 내가 친구 요청 보냄
- 친구 요청 취소
- 차단버튼이 있어야하나?

pendingReceiver: 친구 요청 대기
- 친구 추가 버튼 없음
- 차단버튼이 있어야하나?

blocked: 차단 당함
- 암것도 안보임

blocker: 내가 차단
- 차단 해제 버튼

normal: 일반
- 친구 요청 버튼
- 차단
*/}
                  <button>게임 초대</button>
                  {
                    {
                      friend: <button>차단</button>,
                      pendingSender: <button>aaa</button>,
                      pendingReceiver: <button>bbb</button>,
                      blocked: <button>cccc</button>,
                      blocker: <button>ddd</button>,
                      normal: <button>eee</button>,
                    }[props.relationship.relationship]
                  }
                  <button>차단</button>
                  <button>친구 추가</button>
                </>
              )}
            </div>
          </div>
        }
      />
    </>
  );
}

export default memo(User);
