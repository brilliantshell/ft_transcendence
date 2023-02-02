import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
} from '@nestjs/common';

import { RelationshipRequest } from '../../util/type';
import { UserRelationshipStorage } from '../../user-status/user-relationship.storage';

@Injectable()
export class BlockedUserGuard implements CanActivate {
  constructor(
    private readonly userRelationshipStorage: UserRelationshipStorage,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const req: RelationshipRequest = context.switchToHttp().getRequest();
    const targetId = Math.floor(Number(req.params.userId));
    const relationship = this.userRelationshipStorage.getRelationship(
      process.env.NODE_ENV === 'development'
        ? Math.floor(Number(req.headers['x-user-id']))
        : req.user.userId,
      targetId,
    );
    req.relationship = relationship;
    if (relationship === 'blocked') {
      throw new ForbiddenException('The user is blocked');
    }
    return true;
  }
}
