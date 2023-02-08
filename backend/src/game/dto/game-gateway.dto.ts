import { GameId } from '../../util/type';

export interface GameStartedDto {
  id: GameId;
  left: string;
  right: string;
}

export interface GameAbortedDto {
  abortedSide: 'left' | 'right';
}

export interface GameCompleteDto {
  id: GameId;
  scores: [number, number];
}
