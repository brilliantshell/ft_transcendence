import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  Injectable,
} from '@nestjs/common';

import { ActivityManager } from '../../user-status/activity.manager';
import { VerifiedRequest } from '../../util/type';

@Injectable()
export class InGameUiGuard implements CanActivate {
  constructor(private readonly activityManager: ActivityManager) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const {
      user: { userId },
      params,
    } = context.switchToHttp().getRequest<VerifiedRequest>();
    if (this.activityManager.getActivity(userId) !== `game-${params.gameId}`) {
      throw new BadRequestException(`The player(${userId}) is not in game UI`);
    }
    return true;
  }
}
