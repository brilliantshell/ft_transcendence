import {
  ArrayUnique,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { GameId, Score } from '../../util/type';
import { Type } from 'class-transformer';

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
  @IsString()
  @Matches(/^[0-9A-Za-z_-]{21}$/)
  id: GameId;

  @ArrayUnique()
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(5, { each: true })
  scores: [Score, Score];
}

export class GameResetBallDto {
  @IsString()
  @Matches(/^[0-9A-Za-z_-]{21}$/)
  gameId: GameId;
}

export class BallDataDto {
  @IsNumber()
  x: number;

  @IsNumber()
  y: number;

  @IsNumber()
  dx: number;

  @IsNumber()
  dy: number;
}

export class PaddlePositionsDto {
  @IsNumber()
  myY: number;

  @IsNumber()
  opponentY: number;
}

export class GameDataDto {
  @IsString()
  @Matches(/^[0-9A-Za-z_-]{21}$/)
  gameId: GameId;

  @ArrayUnique()
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(5, { each: true })
  scores: [Score, Score];

  @IsOptional()
  @ValidateNested()
  @Type(() => BallDataDto)
  ballData: BallDataDto | null;

  @IsOptional()
  @ValidateNested()
  @Type(() => PaddlePositionsDto)
  paddlePositions: PaddlePositionsDto | null;
}

export class GamePlayerYDto {
  @IsString()
  @Matches(/^[0-9A-Za-z_-]{21}$/)
  gameId: GameId;

  @IsNumber()
  y: number;
}
