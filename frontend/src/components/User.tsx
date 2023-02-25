import instance from '../util/Axios';
import UserBase from './UserBase';
import { useEffect, useState } from 'react';
import { useRecoilValue } from 'recoil';
import { myIdState } from '../util/Recoils';
import '../style/User.css';
import { Link } from 'react-router-dom';
import socket from '../util/Socket';
interface Props {
  userId: number;
}

interface Data {
  nickname: string;
  isDefaultImage: boolean;
}

// userBase로 userId, nickname, isDefaultImage, online 넘기기

function User(props: Props) {
  const myId = useRecoilValue(myIdState);
  const [data, setData] = useState<Data>();
  const [activity, setActivity] = useState<string>('offline');
  const [gameId, setGameId] = useState<string | null>(null);

  /**
   * DM
   * 게임 초대 / 게임 관전
   * 차단 / 차단 해제
   * 친구 추가 / 친구 삭제
   */

  useEffect(() => {
    // Promise.all([
    //   new Promise((resolve) => socket.on('userActivity', (data) => {resolve(data)})).then((data) => {}),
    const func = async () => {
      try {
        const response = await instance.get(`/user/${props.userId}/info`);
        setData(response.data);
      } catch (reason) {
        console.error(reason);
      }
      socket.on('userActivity', result => {
        if (result.userId === props.userId) {
          if (activity !== result.activity) {
            setActivity(result.activity);
            if (activity === 'inGame') {
              setGameId(result.gameId);
            }
            // TODO : gameId를 Null로 바꿔주는 과정(필요할 경우)
          }
        }
      });
      socket.on('userRelationship', result => {
        if (result.userId === props.userId) {
          // console.log('userRelationship', result.userId);
        }
      });

      //   const [response, activity, relationship] = await Promise.all([
      // 	instance.get(),
      // 	new Promise(resolve => socket.on('userActivity', resolve)),
      // 	new Promise(resolve => socket.on('userRelationship', resolve)),
      //   ])
    };
    func();

    return () => {
      socket.off('userActivity');
      socket.off('userRelationship');
    };
  }, []);

  return (
    <>
      <UserBase
        userId={props.userId}
        nickname={data?.nickname}
        isDefaultImage={data?.isDefaultImage}
        rightChild={
          <div className="dropdown">
            <img className="dropdownImage" src="/assets/dropdown.svg" />
            <div className="dropdown-content">
              {props.userId === myId ? (
                <div> 본인입니다!!!!!! </div>
              ) : (
                <>
                  <button>DM</button>
                  <button>게임 초대</button>
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

export default User;
