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
import { UserId, VerifiedRequest } from '../../util/type';

@Injectable()
export class LadderQueueInterceptor implements NestInterceptor {
  private readonly usersInQueue: Set<UserId> = new Set();
  private readonly waitingQueue: ReplaySubject<UserId> = new ReplaySubject();
  private matchedPair: UserId[] = [];

  constructor(private readonly gameService: GameService) {
    this.waitingQueue.subscribe(this.matchMakePlayers.bind(this));
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<void> {
    const {
      method,
      user: { userId },
    } = context.switchToHttp().getRequest<VerifiedRequest>();
    if (method === 'POST') {
      if (this.usersInQueue.has(userId)) {
        throw new ConflictException(
          `The user(${userId}) has already entered the queue`,
        );
      }
      this.usersInQueue.add(userId);
    } else {
      if (!this.usersInQueue.has(userId)) {
        throw new NotFoundException(`The user(${userId}) is not in the queue`);
      }
      this.usersInQueue.delete(userId);
      if (this.matchedPair[0] === userId) {
        this.matchedPair.length = 0;
      }
    }
    return next
      .handle()
      .pipe(tap(() => method === 'POST' && this.waitingQueue.next(userId)));
  }

  private matchMakePlayers(playerId: UserId) {
    this.matchedPair.push(playerId);
    if (this.matchedPair.length === 2) {
      this.matchedPair = this.matchedPair.filter((id) =>
        this.usersInQueue.has(id),
      );
      if (this.matchedPair.length !== 2) {
        return;
      }
      this.gameService
        .createLadderGame(this.matchedPair as [UserId, UserId])
        .finally(() => {
          this.matchedPair.length = 0;
          this.matchedPair.forEach((id) => this.usersInQueue.delete(id));
        });
    }
  }
}
