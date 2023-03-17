import {
  CanActivate,
  ExecutionContext,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { RelationshipRequest } from '../../util/type';

@Injectable()
export class DeleteBlockGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const { relationship, user } = context
      .switchToHttp()
      .getRequest() as RelationshipRequest;
    if (relationship !== 'blocker') {
      throw new NotFoundException(
        `The user(${user.userId}) had not blocked the other user`,
      );
    }
    return true;
  }
}
