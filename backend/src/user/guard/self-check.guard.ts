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
    if (process.env.NODE_ENV === 'development') {
      req.user = { userId: Math.floor(Number(req.headers['x-user-id'])) };
    }
    if (req.user.userId === Math.floor(Number(req.params.userId))) {
      throw new BadRequestException(
        'The user cannot perform this action on himself/herself',
      );
    }
    return true;
  }
}
