import {
  CallHandler,
  ConflictException,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  NotFoundException,
} from '@nestjs/common';
import { Observable, ReplaySubject, tap } from 'rxjs';

import { GameService } from '../game.service';
import { GameStorage } from '../game.storage';
import { UserId, VerifiedRequest } from '../../util/type';

@Injectable()
export class LadderQueueInterceptor implements NestInterceptor {
  private readonly waitingQueue: ReplaySubject<UserId> = new ReplaySubject();

  constructor(
    private readonly gameService: GameService,
    private readonly gameStorage: GameStorage,
  ) {
    this.waitingQueue.subscribe(this.matchMakePlayers.bind(this));
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<void> {
    const {
      method,
      user: { userId },
    } = context.switchToHttp().getRequest<VerifiedRequest>();
    if (method === 'POST') {
      if (this.gameStorage.isInLadderQueue(userId)) {
        throw new ConflictException(
          `The user(${userId}) has already entered the queue`,
        );
      }
      this.gameStorage.addUserToLadderQueue(userId);
    } else {
      if (!this.gameStorage.isInLadderQueue(userId)) {
        throw new NotFoundException(`The user(${userId}) is not in the queue`);
      }
      this.gameStorage.deleteUserFromLadderQueue(userId);
      if (this.gameStorage.matchedPair[0] === userId) {
        this.gameStorage.matchedPair.length = 0;
      }
    }
    return next
      .handle()
      .pipe(tap(() => method === 'POST' && this.waitingQueue.next(userId)));
  }

  private matchMakePlayers(playerId: UserId) {
    this.gameStorage.matchedPair.push(playerId);
    if (this.gameStorage.matchedPair.length === 2) {
      this.gameStorage.matchedPair = this.gameStorage.matchedPair.filter((id) =>
        this.gameStorage.isInLadderQueue(id),
      );
      if (this.gameStorage.matchedPair.length !== 2) {
        return;
      }
      this.gameService
        .createLadderGame(this.gameStorage.matchedPair as [UserId, UserId])
        .finally(() => {
          this.gameStorage.matchedPair.forEach((id) =>
            this.gameStorage.deleteUserFromLadderQueue(id),
          );
          this.gameStorage.matchedPair.length = 0;
        });
    }
  }
}
