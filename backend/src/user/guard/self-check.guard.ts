import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  Injectable,
} from '@nestjs/common';

import { RelationshipRequest } from '../../util/type';

@Injectable()
export class SelfCheckGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req: RelationshipRequest = context.switchToHttp().getRequest();
    if (!/^[1-9][0-9]{4,5}$/.test(req.params.userId)) {
      throw new BadRequestException('UserId must be between 10000 and 999999');
    }
    req.targetId = Math.floor(Number(req.params.userId));
    if (process.env.NODE_ENV === 'development') {
      req.user = { userId: Math.floor(Number(req.headers['x-user-id'])) };
    }
    if (req.user.userId === req.targetId) {
      throw new BadRequestException(
        `The user(${req.user.userId}) cannot perform this action on himself/herself`,
      );
    }
    return true;
  }
}
