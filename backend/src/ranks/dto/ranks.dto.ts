import { UserId } from '../../util/type';

export interface MyRankDto {
  myRank: number;
  totol: number;
}

interface RankElement {
  userId: UserId;
  ladder: number;
}

export interface RanksDto {
  users: RankElement[];
}
