import { IsIn, IsString, Matches } from 'class-validator';

import { GameId, UserId } from '../../util/type';

export class GameIdParamDto {
  @IsString()
  @Matches(/^[0-9A-Za-z_-]{21}$/)
  gameId: GameId;
}

export class GameMapDto {
  @IsIn([1, 2, 3])
  map: 1 | 2 | 3;
}

export interface LadderGamesDto {
  games: { id: GameId; left: string; right: string }[];
}

export interface GameInfoDto {
  isRank: boolean;
  leftPlayer: string;
  rightPlayer: string;
  map: number;
}

export interface PlayersDto {
  isRank: boolean;
  isLeft: boolean;
  playerId: UserId;
  playerNickname: string;
  opponentId: UserId;
  opponentNickname: string;
}
