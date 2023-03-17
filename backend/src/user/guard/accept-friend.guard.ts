import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { RelationshipRequest } from '../../util/type';

@Injectable()
export class AcceptFriendGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const { relationship, user } = context
      .switchToHttp()
      .getRequest() as RelationshipRequest;
    switch (relationship) {
      case null:
        throw new NotFoundException(
          `The user(${user.userId}) had not received a friend request`,
        );
      case 'blocker':
        throw new BadRequestException(
          `The user(${user.userId}) need to unblock the other user first in order to become friends`,
        );
      case 'pendingSender':
        throw new BadRequestException(
          `The sender(${user.userId}) of a friend request cannot accept it`,
        );
    }
    return true;
  }
}
