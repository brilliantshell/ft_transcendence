import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  Injectable,
} from '@nestjs/common';

import { GameStorage } from '../game.storage';
import { VerifiedRequest } from '../../util/type';

@Injectable()
export class InPlayGuard implements CanActivate {
  constructor(private readonly gameStorage: GameStorage) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const {
      user: { userId },
    } = context.switchToHttp().getRequest<VerifiedRequest>();
    if (this.gameStorage.players.has(userId)) {
      throw new BadRequestException(
        `The player(${userId}) is already in a game`,
      );
    }
    return true;
  }
}
