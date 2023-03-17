import { Socket } from 'socket.io-client';

export async function timeout<T>(ms: number, promise: Promise<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject('timeout');
    }, ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}

export const listenPromise = <T>(socket: Socket, event: string) =>
  new Promise<T>((resolve) => socket.on(event, resolve));

export const calculateLadderRise = (
  winnerLadder: number,
  loserLadder: number,
  scores: number[],
) => {
  const ladderGap = Math.abs(winnerLadder - loserLadder);
  const scoreGap = Math.abs(scores[0] - scores[1]);
  return winnerLadder >= loserLadder
    ? Math.max(Math.floor(scoreGap * (1 - ladderGap / 42)), 1)
    : Math.floor(scoreGap * (1 + ladderGap / 42));
};
