import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { DateTime } from 'luxon';

import { ChannelStorage } from '../../user-status/channel.storage';
import { VerifiedRequest } from '../../util/type';

@Injectable()
export class MemberExistGuard implements CanActivate {
  constructor(private readonly channelStorage: ChannelStorage) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<VerifiedRequest>();
    const { channelId } = req.params;
    const { userId } = req.user;
    const safeChannelId = Math.floor(Number(channelId));
    if (!this.channelStorage.getUserRole(safeChannelId, userId)) {
      throw (await this.channelStorage.getBanEndAt(safeChannelId, userId)) >
        DateTime.now()
        ? new ForbiddenException('This user is banned from the channel')
        : new ForbiddenException('This user is not a member of the channel');
    }
    return true;
  }
}
