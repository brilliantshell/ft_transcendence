import {
  CallHandler,
  ConflictException,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, Subject, bufferCount, tap } from 'rxjs';
import { nanoid } from 'nanoid';

import { GameGateway } from '../game.gateway';
import { GameStorage } from '../game.storage';
import { GameInfo, UserId, VerifiedRequest } from '../../util/type';
import { UserSocketStorage } from '../../user-status/user-socket.storage';

@Injectable()
export class LadderQueueInterceptor implements NestInterceptor {
  private readonly usersInQueue: Set<UserId> = new Set();
  private readonly waitingQueue: Subject<UserId> = new Subject();

  constructor(
    private readonly gameGateway: GameGateway,
    private readonly gameStorage: GameStorage,
    private readonly userSocketStorage: UserSocketStorage,
  ) {
    this.waitingQueue
      .pipe(bufferCount(2))
      .subscribe(this.createGame.bind(this));
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const {
      user: { userId },
    } = context.switchToHttp().getRequest<VerifiedRequest>();
    if (this.usersInQueue.has(userId)) {
      throw new ConflictException(
        `The user(${userId}) is already in the queue`,
      );
    }
    this.usersInQueue.add(userId);
    return next.handle().pipe(tap(() => this.waitingQueue.next(userId)));
  }

  private async createGame(players: [UserId, UserId]) {
    if (players.length !== 2) return;
    players.forEach((userId) => this.usersInQueue.delete(userId));
    const gameId = nanoid();
    await this.gameStorage.createGame(
      gameId,
      new GameInfo(players[0], players[1], 1, true),
    );
    players.forEach((userId) =>
      this.gameGateway.joinRoom(
        this.userSocketStorage.clients.get(userId),
        `game-${gameId}`,
      ),
    );
    this.gameGateway.emitNewGame(gameId);
  }
}
