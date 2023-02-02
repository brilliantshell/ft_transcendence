import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  Injectable,
} from '@nestjs/common';

import { RelationshipRequest } from '../../util/type';

@Injectable()
export class AcceptFriendGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const { relationship } = context
      .switchToHttp()
      .getRequest() as RelationshipRequest;
    if (relationship === 'blocker') {
      throw new BadRequestException(
        'The user need to unblock the other user first in order to become friends',
      );
    }
    if (relationship === 'pendingSender') {
      throw new BadRequestException(
        'The sender of a friend request cannot accept it',
      );
    }
    return true;
  }
}
