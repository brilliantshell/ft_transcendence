import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { DateTime } from 'luxon';

import { ChannelId, UserId, VerifiedRequest } from '../../util/type';
import { ChannelStorage } from '../../user-status/channel.storage';
import { UserRelationshipStorage } from '../../user-status/user-relationship.storage';

@Injectable()
export class MemberMessagingGuard implements CanActivate {
  constructor(
    private readonly channelStorage: ChannelStorage,
    private readonly userRelationshipStorage: UserRelationshipStorage,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<VerifiedRequest>();
    const { userId } = req.user;
    const channelId = Math.floor(Number(req.params.channelId));
    this.checkIsReadonly(channelId, userId);
    return true;
  }

  checkIsReadonly(channelId: ChannelId, userId: UserId) {
    if (
      this.channelStorage.getUser(userId).get(channelId).muteEndAt >
        DateTime.now() ||
      this.userRelationshipStorage.isBlockedDm(channelId) === true
    ) {
      throw new ForbiddenException('You are muted');
    }
  }
}
