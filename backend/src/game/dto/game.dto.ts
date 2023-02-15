import { IsString, Matches } from 'class-validator';

import { GameId, UserId } from '../../util/type';

export class GameIdParamDto {
  @IsString()
  @Matches(/^[0-9A-Za-z_-]{21}$/)
  gameId: GameId;
}

export interface LadderGamesDto {
  games: { id: GameId; left: string; right: string }[];
}

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
