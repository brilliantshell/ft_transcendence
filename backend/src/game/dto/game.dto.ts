import { UserId } from '../../util/type';

export interface GameInfoDto {
  leftPlayer: string;
  rightPlayer: string;
  map: number;
}

export interface PlayersDto {
  isLeft: boolean;
  playerId: UserId;
  playerNickname: string;
  opponentId: UserId;
  opponentNickname: string;
}
