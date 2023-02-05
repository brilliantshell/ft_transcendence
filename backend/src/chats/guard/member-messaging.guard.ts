import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { DateTime } from 'luxon';
import { ChannelId, UserId } from 'src/util/type';

import { ChannelStorage } from '../../user-status/channel.storage';
import { UserRelationshipStorage } from '../../user-status/user-relationship.storage';

@Injectable()
export class MemberMessagingGuard implements CanActivate {
  constructor(
    private readonly channelStorage: ChannelStorage,
    private readonly userRelationshipStorage: UserRelationshipStorage,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest</* VerifiedRequest */ any>();
    const { userId } = req.user;
    const channelId = Math.floor(Number(req.params.channelId));
    // FIXME : DateTime 클라이언트에서 받을지 결정 후 수정
    const now = DateTime.now();
    this.checkIsReadonly(channelId, userId, now);
    req.createdAt = now;
    return true;
  }

  checkIsReadonly(channelId: ChannelId, userId: UserId, now: DateTime) {
    if (
      this.channelStorage.getUser(userId).get(channelId).muteEndAt > now ||
      this.userRelationshipStorage.isBlockedDm(channelId) === true
    ) {
      throw new ForbiddenException('You are muted');
    }
  }
}
