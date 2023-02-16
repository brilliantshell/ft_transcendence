import {
  CallHandler,
  ConflictException,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, ReplaySubject, bufferCount, tap } from 'rxjs';

import { GameService } from '../game.service';
import { UserId, VerifiedRequest } from '../../util/type';

@Injectable()
export class LadderQueueInterceptor implements NestInterceptor {
  private readonly usersInQueue: Set<UserId> = new Set();
  private readonly waitingQueue: ReplaySubject<UserId> = new ReplaySubject();

  constructor(private readonly gameService: GameService) {
    this.waitingQueue
      .pipe(bufferCount(2))
      .subscribe((players: [UserId, UserId]) => {
        players.forEach((userId) => this.usersInQueue.delete(userId));
        this.gameService.createLadderGame(players);
      });
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<void> {
    const {
      user: { userId },
    } = context.switchToHttp().getRequest<VerifiedRequest>();
    if (this.usersInQueue.has(userId)) {
      throw new ConflictException(
        `The user(${userId}) has already entered the queue`,
      );
    }
    this.usersInQueue.add(userId);
    return next.handle().pipe(tap(() => this.waitingQueue.next(userId)));
  }
}
