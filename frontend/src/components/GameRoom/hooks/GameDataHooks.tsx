import { AxiosError } from 'axios';
import { ErrorAlert } from '../../../util/Alert';
import instance from '../../../util/Axios';
import { listenOnce, socket } from '../../../util/Socket';
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export function useRequestGame(
  isConnected: boolean,
  gameId: string,
  setGameInfo: React.Dispatch<React.SetStateAction<GameInfoData | null>>,
) {
  const nav = useNavigate();

  const listenGameAbortedOnce = (isLeft: boolean | null) => {
    listenOnce<{ abortedSide: 'left' | 'right' }>('gameAborted').then(
      ({ abortedSide }) => {
        const message =
          isLeft !== null
            ? (isLeft && abortedSide === 'right') ||
              (!isLeft && abortedSide === 'left')
              ? '상대방이 게임을 중단했습니다.<br/>당신의 승리로 기록되었습니다!'
              : '게임을 중단했습니다.<br/>당신의 패배로 기록되었습니다.'
            : '게임이 중단되었습니다.';
        ErrorAlert('게임 중단', message);
        if (window.location.pathname === `/game/${gameId}`) {
          nav('/waiting-room');
        }
      },
    );
  };

  const requestGameStart = async () => {
    try {
      listenOnce('gameCancelled').then(() => {
        ErrorAlert(
          '게임 취소',
          '상대방이 게임에 접속하지 않아 취소되었습니다.',
        );
        nav('/waiting-room');
      });
      await instance.patch(`/game/${gameId}/start`);
      setGameInfo(prev => {
        if (prev) {
          return { ...prev, isStarted: true };
        }
        return null;
      });
    } catch (e) {
      const response = (e as AxiosError).response;
      if (
        response &&
        response.status === 400 &&
        (response.data as any).message ===
          `The game(${gameId}) has already been started`
      ) {
        return;
      }
      ErrorAlert('게임 시작', '게임을 시작하는데 실패했습니다.');
      nav('/waiting-room');
    }
  };

  useEffect(() => {
    if (isConnected) {
      instance
        .get(`/game/${gameId}`)
        .then(({ data }: { data: GameInfoResponse }) => {
          const {
            isRank,
            isPlayer,
            isStarted,
            isLeft,
            leftNickname,
            rightNickname,
          } = data;
          listenGameAbortedOnce(isPlayer ? isLeft : null);
          setGameInfo({
            id: gameId,
            isRank,
            isPlayer,
            isStarted,
            isLeft,
            players: [leftNickname, rightNickname],
          });
          if (isPlayer && isRank && !isStarted) {
            requestGameStart();
          }
        })
        .catch(() => {
          ErrorAlert('게임 정보 요청', '게임 정보를 가져오는데 실패했습니다.');
          nav('/waiting-room');
        });
    }
    return () => {
      socket.off('gameAborted');
      socket.off('gameCancelled');
    };
  }, [isConnected]);
}

// SECTION : Interfaces

export interface GameInfoData {
  id: string;
  isRank: boolean;
  isPlayer: boolean;
  isLeft: boolean;
  isStarted: boolean;
  players: [string, string];
}

interface GameInfoResponse {
  isRank: boolean;
  isPlayer: boolean;
  isLeft: boolean;
  isStarted: boolean;
  leftId: number;
  leftNickname: string;
  rightId: number;
  rightNickname: string;
  mode: 0 | 1 | 2;
}
