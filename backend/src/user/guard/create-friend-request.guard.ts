import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  Injectable,
} from '@nestjs/common';

import { RelationshipRequest } from '../../util/type';

@Injectable()
export class CreateFriendRequestGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const { relationship } = context
      .switchToHttp()
      .getRequest() as RelationshipRequest;

    if (relationship === 'blocker') {
      throw new BadRequestException(
        'The user need to unblock the other user first in order to become friends',
      );
    }
    if (relationship === 'friend' || relationship === 'pendingReceiver') {
      throw new BadRequestException(
        'The user had already received a friend request from or been friends with the other user',
      );
    }
    return true;
  }
}
