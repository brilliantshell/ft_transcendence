import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  Injectable,
} from '@nestjs/common';

import { GameRequest } from '../../util/type';

@Injectable()
export class LadderRestrictionGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<GameRequest>();
    const {
      user: { userId },
      gameInfo: { isRank },
    } = req;
    if (isRank) {
      throw new BadRequestException(
        `The requester(${userId}) cannot modify a ladder game`,
      );
    }
    return true;
  }
}
