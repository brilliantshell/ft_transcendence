export interface Dimensions {
  w: number;
  h: number;
}

export interface GameInfo {
  id: string;
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
  initialSpeed: number;
  midX: number;
  midY: number;
  paddleW: number;
  paddleH: number;
  maxSpeed: number;
  acceleration: number;
  paddleEnds: {
    left: number;
    right: number;
  };
  boardEdges: {
    top: number;
    bottom: number;
    left: number;
    right: number;
  };

  constructor({ w, h }: { w: number; h: number }) {
    this.radius = w / 120;
    this.initialSpeed = w / 360;
    this.midX = w / 2;
    this.midY = h / 2;
    this.paddleW = h / 6;
    this.paddleH = (this.radius * 3) / 2;
    this.maxSpeed = this.initialSpeed * 2;
    this.acceleration = this.initialSpeed / 10;
    this.paddleEnds = { left: this.radius * 4, right: w - this.radius * 4 };
    this.boardEdges = {
      top: this.radius,
      bottom: h - this.radius,
      left: this.radius,
      right: w - this.radius,
    };
  }
}

export interface BallData {
  x: number;
  y: number;
  dx: number;
  dy: number;
}

export interface PaddlePositions {
  myY: number;
  opponentY: number;
}
