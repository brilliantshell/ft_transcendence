import { IsBoolean, IsString, Matches } from 'class-validator';

import {
  BallCoordinates,
  GameId,
  PaddlePositions,
  Score,
} from '../../util/type';

export interface NewGameDto {
  gameId: GameId;
  inviterNickname?: string;
}

export interface GameOptionDto {
  map: 1 | 2 | 3;
}

export interface GameStartedDto {
  id: GameId;
  left: string;
  right: string;
}

export interface GameAbortedDto {
  abortedSide: 'left' | 'right';
}

export class GameCompleteDto {
  winnerSide: 'left' | 'right';
}

export interface GameDataDto {
  scores: [Score, Score];
  ballCoords: BallCoordinates;
  paddlePositions: PaddlePositions;
}

export class GamePlayerYDto {
  @IsString()
  @Matches(/^[0-9A-Za-z_-]{21}$/)
  gameId: GameId;

  @IsBoolean()
  isLeft: boolean;

  @IsBoolean()
  isUp: boolean;
}
