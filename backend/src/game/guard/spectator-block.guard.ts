import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';

import { GameRequest } from '../../util/type';
import { UserRelationshipStorage } from '../../user-status/user-relationship.storage';

@Injectable()
export class SpectatorBlockGuard implements CanActivate {
  constructor(
    private readonly userRelationshipStorage: UserRelationshipStorage,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const {
      user: { userId },
      gameInfo,
    }: GameRequest = context.switchToHttp().getRequest();
    const { leftId, rightId, isRank } = gameInfo;
    if (userId !== leftId && userId !== rightId) {
      const [leftRelationship, rightRelationship] = [
        this.userRelationshipStorage.getRelationship(userId, leftId),
        this.userRelationshipStorage.getRelationship(userId, rightId),
      ];
      if (
        !isRank &&
        (leftRelationship?.startsWith('block') ||
          rightRelationship?.startsWith('block'))
      ) {
        throw new ForbiddenException(
          `The requester(${userId}) is either blocked by or a blocker of a game participant`,
        );
      }
    }
    return true;
  }
}
