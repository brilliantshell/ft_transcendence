import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';

import { GameRequest } from '../../util/type';
import { GameStorage } from '../game.storage';

@Injectable()
export class IsPlayerGuard implements CanActivate {
  constructor(private readonly gameStorage: GameStorage) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<GameRequest>();
    const {
      user: { userId },
      params: { gameId },
    } = req;
    if (this.gameStorage.players.get(userId) !== gameId) {
      throw new ForbiddenException(
        `The requester(${userId}) is not a participant of the game`,
      );
    }
    return true;
  }
}
