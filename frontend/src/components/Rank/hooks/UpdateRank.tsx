import { useEffect } from 'react';
import { socket } from '../../../util/Socket';
import { MyRankInfo, RankData } from '../interface';

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
const OUT_OF_RANK = 4242;

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
      } else if (upperBound === EMPTY_RANK && prev[i].ladder < ladder) {
        newPos = prev[i].rank - 1;
        upperBound = prev[i];
        if (lowerBound === EMPTY_RANK) {
          lowerBound = upperBound;
        }
      } else if (lowerBound === EMPTY_RANK && prev[i].ladder === ladder) {
        lowerBound = prev[i];
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
      const { winnerId, ladder } = ladderUpdate;
      if (prev.length === 0) {
        return [{ id: winnerId, ladder, rank: 1 }];
      }

      const rankUpdateInfo = findRankInfo(prev, winnerId, ladder);
      const { newPos, prevPos } = rankUpdateInfo;

      if (newPos === EMPTY_POS) {
        return prevPos === EMPTY_POS ? prev : removeFromRank(prev, prevPos);
      }
      if (prevPos === EMPTY_POS) {
        return addToRank(prev, ladderUpdate, rankUpdateInfo);
      }

      if (prevPos > newPos) {
        return updateRankToHigher(prev, ladderUpdate, rankUpdateInfo);
      } else if (prevPos < newPos) {
        return updateRankToLower(prev, ladderUpdate, rankUpdateInfo);
      } else {
        return updateRankInSamePos(prev, ladderUpdate, rankUpdateInfo);
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

export function useUpdateMyRank(
  setMyRankInfo: React.Dispatch<React.SetStateAction<MyRankInfo>>,
  myId: number,
  rankData: RankData[],
) {
  useEffect(() => {
    if (rankData.length === 0) {
      return;
    }
    const data = rankData.find(({ id }) => id == myId);
    const limit = rankData[rankData.length - 1].rank;
    data
      ? setMyRankInfo({ myRank: data.rank, limit })
      : setMyRankInfo({ myRank: OUT_OF_RANK, limit });
  }, [rankData]);
}
