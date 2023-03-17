import {
  CanActivate,
  ExecutionContext,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { RelationshipRequest } from '../../util/type';

@Injectable()
export class DeleteFriendGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const { relationship, user } = context
      .switchToHttp()
      .getRequest() as RelationshipRequest;
    if (
      !['friend', 'pendingSender', 'pendingReceiver'].includes(relationship)
    ) {
      throw new NotFoundException(
        `The user(${user.userId}) had not received/sent a friend request nor been friends with the other user`,
      );
    }
    return true;
  }
}
