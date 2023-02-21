import {
  BadRequestException,
  CallHandler,
  ConflictException,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NestInterceptor,
  NotFoundException,
} from '@nestjs/common';
import { Observable, ReplaySubject, bufferCount, tap, timeout } from 'rxjs';

import { GameId, GameInfo, UserId, VerifiedRequest } from '../../util/type';
import { GameService } from '../game.service';
import { GameStorage } from '../game.storage';

const START_QUEUE_TIMEOUT =
  process.env.NODE_ENV !== 'production' ? 1000 : 10000;

@Injectable()
export class GameStartInterceptor implements NestInterceptor {
  private readonly gameSubjectMap: Map<GameId, ReplaySubject<UserId>> =
    new Map();
  private readonly waitingPlayers: Set<UserId> = new Set();

  constructor(
    private readonly gameService: GameService,
    private readonly gameStorage: GameStorage,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<void> {
    const {
      user: { userId },
      params: { gameId },
    } = context.switchToHttp().getRequest<VerifiedRequest>();
    const gameInfo = this.gameStorage.getGame(gameId);
    this.checkGameInfo(userId, gameId, gameInfo);
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

  private checkGameInfo(
    requesterId: UserId,
    gameId: GameId,
    gameInfo: GameInfo,
  ) {
    if (gameInfo === undefined) {
      throw new NotFoundException(`The game(${gameId}) does not exist`);
    }
    const { leftId, rightId, scores } = gameInfo;
    if (leftId !== requesterId && rightId !== requesterId) {
      throw new ForbiddenException(
        `The user(${requesterId}) is not a player of the game(${gameId})`,
      );
    }
    if (scores !== null) {
      throw new BadRequestException(
        `The game(${gameId}) has already been started`,
      );
    }
  }

  private createGameStartQueue(
    requesterId: UserId,
    gameId: GameId,
    gameInfo: GameInfo,
  ) {
    const queue = new ReplaySubject<UserId>(2);
    queue.pipe(timeout(START_QUEUE_TIMEOUT), bufferCount(2)).subscribe({
      next: (players: [UserId, UserId]) => {
        players.forEach((userId) => this.waitingPlayers.delete(userId));
        this.gameService.startGame(gameId, gameInfo);
        this.gameSubjectMap.delete(gameId);
      },
      error: () => {
        this.gameService.deleteCancelledGame(gameId);
        this.gameSubjectMap.delete(gameId);
        this.waitingPlayers.delete(gameInfo.leftId);
        this.waitingPlayers.delete(gameInfo.rightId);
      },
    });
    this.gameSubjectMap.set(gameId, queue);
    queue.next(requesterId);
  }
}
