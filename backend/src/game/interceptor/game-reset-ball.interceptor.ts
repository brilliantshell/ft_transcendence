import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, ReplaySubject, bufferCount, tap } from 'rxjs';

import { GameId } from '../../util/type';
import { GameService } from '../game.service';

@Injectable()
export class GameResetBallInterceptor implements NestInterceptor {
  private readonly resetQueues = new Map<GameId, ReplaySubject<void>>();

  constructor(private readonly gameService: GameService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<void> {
    return next.handle().pipe(
      tap((gameId) => {
        const queue = this.resetQueues.get(gameId);
        queue === undefined ? this.createResetQueue(gameId) : queue.next();
      }),
    );
  }

  private createResetQueue(gameId: GameId) {
    const queue = new ReplaySubject<void>(2);
    this.resetQueues.set(gameId, queue);
    const subscription = queue.pipe(bufferCount(2)).subscribe(() => {
      this.gameService.resetBall(gameId);
      subscription.unsubscribe();
      this.resetQueues.delete(gameId);
    });
    queue.next();
  }
}
