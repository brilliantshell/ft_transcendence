import {
  BadRequestException,
  CallHandler,
  ConflictException,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, ReplaySubject, bufferCount, tap, timeout } from 'rxjs';

import { GameId, GameInfo, GameRequest, UserId } from '../../util/type';
import { GameService } from '../game.service';

const START_QUEUE_TIMEOUT =
  process.env.NODE_ENV !== 'production' ? 2000 : 10000;

@Injectable()
export class GameStartInterceptor implements NestInterceptor {
  private readonly gameSubjectMap: Map<GameId, ReplaySubject<UserId>> =
    new Map();
  private readonly waitingPlayers: Set<UserId> = new Set();

  constructor(private readonly gameService: GameService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<void> {
    const {
      user: { userId },
      params: { gameId },
      gameInfo,
    } = context.switchToHttp().getRequest<GameRequest>();
    if (gameInfo.isStarted) {
      throw new BadRequestException(
        `The game(${gameId}) has already been started`,
      );
    }
    if (this.waitingPlayers.has(userId)) {
      throw new ConflictException(
        `The user(${userId}) has already entered the game start queue`,
      );
    }
    this.waitingPlayers.add(userId);
    return next.handle().pipe(
      tap(() => {
        const queue = this.gameSubjectMap.get(gameId);
        queue === undefined
          ? this.createGameStartQueue(userId, gameId, gameInfo)
          : queue.next(userId);
      }),
    );
  }

  private createGameStartQueue(
    requesterId: UserId,
    gameId: GameId,
    gameInfo: GameInfo,
  ) {
    const queue = new ReplaySubject<UserId>(2);
    const subscription = queue
      .pipe(timeout(START_QUEUE_TIMEOUT), bufferCount(2))
      .subscribe({
        next: (players: [UserId, UserId]) => {
          players.forEach((userId) => this.waitingPlayers.delete(userId));
          this.gameService.startGame(gameId, gameInfo);
          subscription.unsubscribe();
          this.gameSubjectMap.delete(gameId);
        },
        error: () => {
          this.gameService.deleteCancelledGame(gameId);
          subscription.unsubscribe();
          this.gameSubjectMap.delete(gameId);
          this.waitingPlayers.delete(gameInfo.leftId);
          this.waitingPlayers.delete(gameInfo.rightId);
        },
      });
    this.gameSubjectMap.set(gameId, queue);
    queue.next(requesterId);
  }
}
