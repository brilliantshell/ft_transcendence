import { Injectable } from '@nestjs/common';
import { Subscription, of, repeat } from 'rxjs';

import { BallData, GameData, GameId } from '../util/type';
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
    const { ballData } = gameData;
    const subscription = of(null)
      .pipe(repeat({ delay: 10 }))
      .subscribe(() => {
        const { x, vx } = ballData;
        x + vx < 0 || x + vx > 1
          ? this.updateScore(subscription, gameId, gameData)
          : this.updateBallData(gameData);
        this.gameGateway.emitGameData(gameId, gameData);
      });
  }

  private updateScore(
    subscription: Subscription,
    gameId: GameId,
    gameData: GameData,
  ) {
    const { scores, ballData } = gameData;
    scores[ballData.x > 0.5 ? 0 : 1] += 1;
    setTimeout(() => {
      if (scores[0] === 5 || scores[1] === 5) {
        subscription.unsubscribe();
        this.gameGateway.emitGameComplete(gameId, gameData);
      } else {
        gameData.ballData = {
          x: 0.5,
          y: 0.5,
          vx: Math.random() > 0.5 ? INITIAL_SPEED : -INITIAL_SPEED,
          vy: Math.random() > 0.5 ? INITIAL_SPEED : -INITIAL_SPEED,
        };
      }
    }, 250);
  }

  private updateBallData(gameData: GameData) {
    const { ballData } = gameData;
    const { x, y, vx, vy } = ballData;
    const { leftY, rightY } = gameData.paddlePositions;
    const nextX = x + vx;
    const nextY = y + vy;
    if (nextY < 0 || nextY > 1) {
      ballData.vy = -vy;
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
      ballData.vx = -vx;
      this.accelerate(ballData);
    }
    ballData.x += ballData.vx;
    ballData.y += ballData.vy;
  }

  private accelerate(ballData: BallData) {
    const { vx, vy } = ballData;
    if (vx < MAX_SPEED) {
      ballData.vx += vx > 0 ? ACCELERATION : -ACCELERATION;
    }
    if (vy < MAX_SPEED) {
      ballData.vy += vy > 0 ? ACCELERATION : -ACCELERATION;
    }
  }
}
