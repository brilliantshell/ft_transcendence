import {
  BadRequestException,
  CanActivate,
  ConflictException,
  ExecutionContext,
  Injectable,
} from '@nestjs/common';

import { GameStorage } from '../../game/game.storage';
import { RelationshipRequest } from '../../util/type';

@Injectable()
export class CreateGameGuard implements CanActivate {
  constructor(private readonly gameStorage: GameStorage) {}

  canActivate(context: ExecutionContext): boolean {
    const { user, targetId } = context
      .switchToHttp()
      .getRequest() as RelationshipRequest;
    if (this.gameStorage.players.has(user.userId)) {
      throw new BadRequestException(
        `The inviter(${user.userId}) is already in a game`,
      );
    }
    if (this.gameStorage.players.has(targetId)) {
      throw new ConflictException(
        `The invited(${targetId}) is already in a game`,
      );
    }
    return true;
  }
}
