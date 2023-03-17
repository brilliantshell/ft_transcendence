import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { GameRequest } from '../../util/type';
import { GameStorage } from '../game.storage';

@Injectable()
export class ExistingGameGuard implements CanActivate {
  constructor(private readonly gameStorage: GameStorage) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<GameRequest>();
    const {
      user: { userId },
      params: { gameId },
    } = req;
    if (!gameId.match(/^[0-9A-Za-z_-]{21}$/)) {
      throw new BadRequestException(
        `The game(${gameId}) requested by ${userId} is not valid`,
      );
    }
    const gameInfo = this.gameStorage.getGame(gameId);
    if (gameInfo === undefined) {
      throw new NotFoundException(
        `The game(${gameId}) requested by ${userId} does not exist`,
      );
    }
    req.gameInfo = gameInfo;
    return true;
  }
}
