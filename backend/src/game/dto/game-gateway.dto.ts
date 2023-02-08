import {
  IsInt,
  IsString,
  Length,
  Min,
  Max,
  ArrayUnique,
} from 'class-validator';

import { GameId } from '../../util/type';

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
  @Length(21)
  id: GameId;

  @ArrayUnique()
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(5, { each: true })
  scores: [number, number];
}
