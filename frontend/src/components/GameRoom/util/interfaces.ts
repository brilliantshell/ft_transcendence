export interface Dimensions {
  w: number;
  h: number;
}

export interface GameInfo {
  id: string;
  isRank: boolean;
  isStarted: boolean;
  players: [string, string];
}

export interface ControllerType {
  isPlayer: boolean;
  isLeft: boolean;
}

export interface KeyPressed {
  up: boolean;
  down: boolean;
}

export class GameMetaData {
  radius: number;
  midX: number;
  midY: number;
  paddleW: number;
  paddleH: number;
  paddleLeftEnd: number;
  paddleRightEnd: number;

  constructor({ w, h }: { w: number; h: number }) {
    this.radius = w * 0.00833;
    this.midX = w / 2;
    this.midY = h / 2;
    this.paddleW = h * 0.16667;
    this.paddleH = w * 0.0125;
    this.paddleLeftEnd = w * 0.03333;
    this.paddleRightEnd = w * 0.96667;
  }
}

export interface BallCoordinates {
  x: number;
  y: number;
}

export interface PaddlePositions {
  leftY: number;
  rightY: number;
}

export type Score = 1 | 2 | 3 | 4 | 5;

export interface GameDataMessage {
  ballCoords: BallCoordinates;
  paddlePositions: PaddlePositions;
  scores: [Score, Score];
  mode: 0 | 1 | 2;
}
