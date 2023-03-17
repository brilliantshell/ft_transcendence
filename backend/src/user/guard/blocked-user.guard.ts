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
      req.user.userId,
      targetId,
    );
    req.relationship = relationship;
    if (relationship === 'blocked') {
      throw new ForbiddenException(`The user(${req.user.userId}) is blocked`);
    }
    return true;
  }
}
