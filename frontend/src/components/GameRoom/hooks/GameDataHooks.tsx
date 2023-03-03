import { ErrorAlert } from '../../../util/Alert';
import instance from '../../../util/Axios';
import { listenEvent, socket } from '../../../util/Socket';
import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

export function useListenGameEvents(isConnected: boolean) {
  const nav = useNavigate();

  useEffect(() => {
    if (isConnected) {
      listenEvent('gameAborted').then(() => {
        ErrorAlert(
          '게임 중단',
          '상대방이 게임을 중단했습니다.<br/>당신의 승리로 기록되었습니다!',
        );
        nav('/waiting-room'); // NOTE : 일반 게임일 때도?
      });
      listenEvent('gameCancelled').then(() => {
        ErrorAlert(
          '게임 취소',
          '상대방이 게임에 접속하지 않아 취소되었습니다.',
        );
        nav('/waiting-room'); // NOTE : 일반 게임일 때도?
      });
    }
    return () => {
      socket.off('gameAborted');
      socket.off('gameCancelled');
    };
  }, []);
}

export function useRequestGame(
  isConnected: boolean,
  gameId: string,
  setIsStarted: React.Dispatch<React.SetStateAction<boolean>>,
) {
  const [gameInfo, setGameInfo] = useState<GameInfoData | null>(null);
  const [players, setPlayers] = useState<[string, string] | null>(null);
  const nav = useNavigate();
  const location = useLocation();

  const requestGameStart = async () => {
    let isRank = false;
    try {
      const { data }: { data: GameInfoData } = await instance.get(
        `/game/${gameId}`,
      );
      isRank = data.isRank;
      setGameInfo(data);
      setPlayers(
        data.isLeft
          ? [data.playerNickname, data.opponentNickname]
          : [data.opponentNickname, data.playerNickname],
      );
    } catch (e) {
      ErrorAlert('게임 정보 요청', '게임 정보를 가져오는데 실패했습니다.');
      nav('/waiting-room');
    }
    try {
      await instance.patch(`/game/${gameId}/start`);
      isRank && setIsStarted(true);
    } catch (e) {
      ErrorAlert('게임 시작', '게임을 시작하는데 실패했습니다.');
      nav('/waiting-room');
    }
  };

  const requestSpectate = async () => {
    try {
      const { data } = await instance.get(`/game/list/${gameId}`);
      setGameInfo(data);
      setPlayers([data.leftPlayer, data.rightPlayer]);
      data.isRank && setIsStarted(true);
    } catch (e) {
      ErrorAlert('관전 요청', '관전 요청이 실패했습니다.');
      nav('/waiting-room');
    }
  };

  useEffect(() => {
    isConnected && location?.state?.isSpectator
      ? requestSpectate()
      : requestGameStart();
  }, []);
  return { gameInfo, players };
}

// SECTION : Interfaces

interface GameInfoData {
  isRank: boolean;
  isLeft: boolean;
  playerId?: number;
  playerNickname: string;
  opponentId?: number;
  opponentNickname: string;
}
