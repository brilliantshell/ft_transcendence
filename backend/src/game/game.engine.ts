import { Injectable } from '@nestjs/common';
import { Subscription, of, repeat } from 'rxjs';

import { BallVelocity, GameData, GameId } from '../util/type';
import { GameGateway } from './game.gateway';
import { GameStorage } from './game.storage';

const INITIAL_SPEED = 0.005;
const MAX_SPEED = 0.01;
const ACCELERATION = 0.0005;
const PADDLE_WIDTH = 0.16667;
const PADDLE_LEFT_END = 0.04583;
const PADDLE_RIGHT_END = 0.95417;

@Injectable()
export class GameEngine {
  constructor(
    private readonly gameGateway: GameGateway,
    private readonly gameStorage: GameStorage,
  ) {}

  startGame(gameId: GameId, gameData: GameData) {
    const subscription = of(null)
      .pipe(repeat({ delay: 10 }))
      .subscribe(() => {
        const { ballCoords, ballVelocity } = gameData;
        const nextX = ballCoords.x + ballVelocity.vx;
        nextX < 0 || nextX > 1
          ? this.updateScore(subscription, gameId, gameData)
          : this.updateBallData(gameData);
        this.gameGateway.emitGameData(gameId, {
          scores: gameData.scores,
          ballCoords: gameData.ballCoords,
          paddlePositions: gameData.paddlePositions,
        });
      });
  }

  private updateScore(
    subscription: Subscription,
    gameId: GameId,
    gameData: GameData,
  ) {
    const { scores, ballCoords, ballVelocity } = gameData;
    scores[ballCoords.x > 0.5 ? 0 : 1] += 1;
    setTimeout(() => {
      if (scores[0] === 5 || scores[1] === 5) {
        subscription.unsubscribe();
        this.gameGateway.emitGameComplete(gameId, gameData);
      } else {
        ballCoords.x = 0.5 - PADDLE_WIDTH / 2;
        ballCoords.y = 0.5 - PADDLE_WIDTH / 2;
        ballVelocity.vx = Math.random() > 0.5 ? INITIAL_SPEED : -INITIAL_SPEED;
        ballVelocity.vy = Math.random() > 0.5 ? INITIAL_SPEED : -INITIAL_SPEED;
      }
    }, 250);
  }

  private updateBallData(gameData: GameData) {
    const { ballCoords, ballVelocity } = gameData;
    const { x, y } = ballCoords;
    const { vx, vy } = ballVelocity;
    const { leftY, rightY } = gameData.paddlePositions;
    const nextX = x + vx;
    const nextY = y + vy;
    if (nextY < 0 || nextY > 1) {
      ballVelocity.vy = -vy;
    }
    const isPaddleTouched =
      (x > PADDLE_LEFT_END &&
        nextX < PADDLE_LEFT_END &&
        nextY > leftY &&
        nextY < leftY + PADDLE_WIDTH) ||
      (x < PADDLE_RIGHT_END &&
        nextX > PADDLE_RIGHT_END &&
        nextY > rightY &&
        nextY < rightY + PADDLE_WIDTH);
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
