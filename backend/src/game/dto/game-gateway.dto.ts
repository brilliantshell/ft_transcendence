import {
  ArrayUnique,
  IsInt,
  IsString,
  Matches,
  Max,
  Min,
} from 'class-validator';
import { GameId } from '../../util/type';

export interface NewGameDto {
  gameId: GameId;
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
  scores: [number, number];
}
