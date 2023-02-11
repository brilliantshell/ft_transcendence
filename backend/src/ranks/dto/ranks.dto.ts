import { UserId } from '../../util/type';

export interface MyRankDto {
  myRank: number;
  totol: number;
}

interface RankElement {
  id: UserId;
  ladder: number;
  rank: number;
}

export interface RanksDto {
  users: RankElement[];
}
