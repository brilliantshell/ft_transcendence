import { useEffect } from 'react';
import { socket } from '../../../util/Socket';

interface RankData {
  id: number;
  ladder: number;
  rank: number;
}

interface LadderUpdate {
  winnerId: number;
  ladder: number;
}

interface RankUpdateInfo {
  lowerBound: RankData;
  upperBound: RankData;
  prevPos: number;
  newPos: number;
}

const EMPTY_RANK: RankData = { id: 0, ladder: 0, rank: 0 };
const EMPTY_POS = -1;

export function useUpdateRank(
  setRankData: React.Dispatch<React.SetStateAction<RankData[]>>,
) {
  const findRankInfo = (prev: RankData[], winnerId: number, ladder: number) => {
    let lowerBound = EMPTY_RANK;
    let upperBound = EMPTY_RANK;
    let prevPos = EMPTY_POS;
    let newPos = EMPTY_POS;
    for (let i = 0; i < prev.length; i++) {
      if (prevPos !== EMPTY_POS && upperBound !== EMPTY_RANK) {
        break;
      }
      if (prev[i].id === winnerId) {
        prevPos = i;
      } else if (lowerBound === EMPTY_RANK && prev[i].ladder === ladder) {
        lowerBound = prev[i];
      } else if (upperBound === EMPTY_RANK && prev[i].ladder < ladder) {
        newPos = prev[i].rank - 1;
        upperBound = prev[i];
        if (lowerBound === EMPTY_RANK) {
          lowerBound = upperBound;
        }
      }
    }
    if (prevPos !== EMPTY_POS && prevPos < newPos) {
      newPos--;
    }
    return { lowerBound, upperBound, prevPos, newPos };
  };

  const removeFromRank = (prev: RankData[], prevPos: number) => {
    return prev.slice(0, prevPos).concat(
      prev.slice(prevPos + 1).map(({ id, ladder, rank }) => ({
        id,
        ladder,
        rank: rank - 1,
      })),
    );
  };

  const addToRank = (
    prev: RankData[],
    { winnerId, ladder }: LadderUpdate,
    { newPos, lowerBound }: RankUpdateInfo,
  ) => {
    return prev.slice(0, newPos).concat(
      {
        id: winnerId,
        ladder,
        rank: lowerBound.rank,
      },
      prev.slice(newPos, 50 - 1).map(({ id, ladder, rank }) => ({
        id,
        ladder,
        rank: rank + 1,
      })),
    );
  };

  const updateRankInSamePos = (
    prev: RankData[],
    { winnerId, ladder }: LadderUpdate,
    { prevPos, lowerBound, upperBound }: RankUpdateInfo,
  ) => {
    console.log('same');
    return prev.slice(0, prevPos).concat(
      {
        id: winnerId,
        ladder,
        rank: lowerBound === upperBound ? upperBound.rank - 1 : lowerBound.rank,
      },
      prev.slice(prevPos + 1),
    );
  };

  const updateRankToHigher = (
    prev: RankData[],
    { winnerId, ladder }: LadderUpdate,
    { newPos, prevPos, upperBound, lowerBound }: RankUpdateInfo,
  ) => {
    console.log('higher');
    return prev.slice(0, newPos).concat(
      {
        id: winnerId,
        ladder,
        rank: lowerBound === upperBound ? newPos + 1 : lowerBound.rank,
      },
      prev.slice(newPos, prevPos).map(({ id, ladder, rank }) => ({
        id,
        ladder,
        rank: rank + 1,
      })),
      prev.slice(prevPos + 1),
    );
  };

  const updateRankToLower = (
    prev: RankData[],
    { winnerId, ladder }: LadderUpdate,
    { newPos, prevPos, upperBound, lowerBound }: RankUpdateInfo,
  ) => {
    // to lower
    console.log('lower');
    console.log(
      'prev , newPos, prevPos',
      prev.slice(prevPos - 1, newPos + 1),
      newPos,
      prevPos,
      prev.slice(prevPos + 1, newPos + 1),
    );
    return prev.slice(0, prevPos).concat(
      prev.slice(prevPos + 1, newPos + 1).map(({ id, ladder, rank }) => ({
        id,
        ladder,
        rank: rank - 1,
      })),
      {
        id: winnerId,
        ladder,
        rank: lowerBound === upperBound ? newPos : lowerBound.rank - 1,
      },
      prev.slice(newPos + 1).map(({ id, ladder, rank }) => ({
        id,
        ladder,
        rank: rank,
      })),
    );
  };

  const handleLadderUpdate = (ladderUpdate: LadderUpdate) => {
    setRankData(prev => {
      console.log('####start! length : ', prev.length);
      const { winnerId, ladder } = ladderUpdate;
      if (prev.length === 0) {
        return [{ id: winnerId, ladder, rank: 1 }];
      }
      const rankUpdateInfo: RankUpdateInfo = findRankInfo(
        prev,
        winnerId,
        ladder,
      );
      console.table(rankUpdateInfo);

      const { newPos, prevPos } = rankUpdateInfo;
      if (newPos === EMPTY_POS) {
        console.log('remove');
        return prevPos === EMPTY_POS ? prev : removeFromRank(prev, prevPos);
      }
      if (prevPos === EMPTY_POS) {
        console.log('add');
        return addToRank(prev, ladderUpdate, rankUpdateInfo);
      }
      if (prevPos === newPos) {
        return updateRankInSamePos(prev, ladderUpdate, rankUpdateInfo);
      }
      if (prevPos > newPos) {
        return updateRankToHigher(prev, ladderUpdate, rankUpdateInfo);
      } else {
        return updateRankToLower(prev, ladderUpdate, rankUpdateInfo);
      }
    });
  };

  useEffect(() => {
    socket.on('ladderUpdate', handleLadderUpdate);
    return () => {
      socket.off('ladderUpdate', handleLadderUpdate);
    };
  }, []);
}
