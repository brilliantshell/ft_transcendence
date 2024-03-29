import { Injectable } from '@nestjs/common';
import { ReplaySubject } from 'rxjs';

import { BallVelocity, GameData, GameId } from '../util/type';
import { GameGateway } from './game.gateway';

const BALL_RADIUS = 0.00833;
const INITIAL_SPEED = 0.004;
const MAX_SPEED = 0.01;
const ACCELERATION = 0.0004;
const PADDLE_LEFT_END = 0.03333;
const PADDLE_RIGHT_END = 0.96667;

const GAME_META_DATA = [
  {
    ballRadius: 0.00833,
    paddleWidth: BALL_RADIUS * 20,
  },
  {
    ballRadius: 0.00833 * 3,
    paddleWidth: 0.00833 * 20,
  },
  {
    ballRadius: 0.00833,
    paddleWidth: (BALL_RADIUS * 40) / 3,
  },
];

@Injectable()
export class GameEngine {
  constructor(private readonly gameGateway: GameGateway) {}

  startGame(gameId: GameId, gameData: GameData, mode: 0 | 1 | 2) {
    const subject = new ReplaySubject<void>(1);
    gameData.intervalId = setInterval(() => subject.next(), 10);
    gameData.subscription = subject.subscribe(() => {
      const { ballCoords, ballVelocity } = gameData;
      const nextX = ballCoords.x + ballVelocity.vx;
      nextX < 0 || nextX > 1
        ? this.updateScore(gameId, gameData, subject)
        : this.updateBallData(gameData, mode);
      this.gameGateway.emitGameData(gameId, {
        scores: gameData.scores,
        ballCoords: gameData.ballCoords,
        paddlePositions: gameData.paddlePositions,
        mode,
      });
    });
  }

  private updateScore(
    gameId: GameId,
    gameData: GameData,
    subject: ReplaySubject<void>,
  ) {
    const { scores, ballCoords, ballVelocity, subscription, intervalId } =
      gameData;
    scores[ballCoords.x > 0.5 ? 0 : 1] += 1;
    clearInterval(intervalId);
    setTimeout(() => {
      if (scores[0] === 5 || scores[1] === 5) {
        subscription.unsubscribe();
        this.gameGateway.emitGameComplete(gameId, gameData);
      } else {
        ballCoords.x = 0.5;
        ballCoords.y = 0.5;
        ballVelocity.vx = Math.random() > 0.5 ? INITIAL_SPEED : -INITIAL_SPEED;
        ballVelocity.vy = Math.random() > 0.5 ? INITIAL_SPEED : -INITIAL_SPEED;
        gameData.intervalId = setInterval(() => subject.next(), 10);
      }
    }, 500);
  }

  private updateBallData(gameData: GameData, mode: 0 | 1 | 2) {
    const { ballCoords, ballVelocity } = gameData;
    const { x, y } = ballCoords;
    const { vx, vy } = ballVelocity;
    const { leftY, rightY } = gameData.paddlePositions;
    const nextX = x + vx;
    const nextY = y + vy;
    if (nextY < 0 || nextY > 1) {
      ballVelocity.vy = -vy;
    }
    const paddleWidth = GAME_META_DATA[mode].paddleWidth;
    const isPaddleTouched =
      (x > PADDLE_LEFT_END &&
        nextX < PADDLE_LEFT_END &&
        nextY > leftY &&
        nextY < leftY + paddleWidth) ||
      (x < PADDLE_RIGHT_END &&
        nextX > PADDLE_RIGHT_END &&
        nextY > rightY &&
        nextY < rightY + paddleWidth);
    if (isPaddleTouched) {
      ballVelocity.vx = -vx;
      this.accelerate(ballVelocity);
    }
    ballCoords.x += ballVelocity.vx;
    ballCoords.y += ballVelocity.vy;
  }

  private accelerate(ballVelocity: BallVelocity) {
    const { vx, vy } = ballVelocity;
    if (vx < MAX_SPEED) {
      ballVelocity.vx += vx > 0 ? ACCELERATION : -ACCELERATION;
    }
    if (vy < MAX_SPEED) {
      ballVelocity.vy += vy > 0 ? ACCELERATION : -ACCELERATION;
    }
  }
}
