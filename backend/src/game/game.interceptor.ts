import {
  CallHandler,
  ExecutionContext,
  Inject,
  Injectable,
  NestInterceptor,
  forwardRef,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { Socket } from 'socket.io';
import { WsException } from '@nestjs/websockets';

import { GameCompleteDto } from './dto/game-gateway.dto';
import { GameGateway } from './game.gateway';
import { GameStorage } from './game.storage';
import { UserSocketStorage } from '../user-status/user-socket.storage';

@Injectable()
export class GameCompleteInterceptor implements NestInterceptor {
  constructor(
    @Inject(forwardRef(() => GameGateway))
    private readonly gameGateway: GameGateway,
    private readonly gameStorage: GameStorage,
    private readonly userSocketStorage: UserSocketStorage,
  ) {}

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<any>> {
    const { id: socketId }: Socket = context.switchToWs().getClient();
    const { id: gameId, scores }: GameCompleteDto = context
      .switchToWs()
      .getData();
    if (typeof gameId !== 'string' || gameId.length !== 21) {
      throw new WsException('Invalid id');
    }
    const gameInfo = this.gameStorage.games.get(gameId);
    if (gameInfo === undefined) {
      throw new WsException('Game not found');
    }
    if (
      !Array.isArray(scores) ||
      scores.length !== 2 ||
      scores[0] === scores[1] ||
      scores.some((score) => score < 0 || score > 5)
    ) {
      this.gameGateway.leaveRoom(socketId, `game-${gameId}`);
      await this.gameGateway.emitGameAborted(
        `game-${gameId}`,
        gameId,
        gameInfo.leftId === this.userSocketStorage.sockets.get(socketId)
          ? 'left'
          : 'right',
      );
      this.gameGateway.destroyRoom(`game-${gameId}`);
      throw new WsException('Invalid scores');
    }
    return next.handle();
  }
}
