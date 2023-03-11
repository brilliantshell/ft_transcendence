import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';

import { ChannelStorage } from '../../user-status/channel.storage';
import { VerifiedRequest } from '../../util/type';

@Injectable()
export class ChannelOwnerGuard implements CanActivate {
  constructor(private readonly channelStorage: ChannelStorage) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<VerifiedRequest>();
    const { channelId } = req.params;
    const safeChannelId = Math.floor(Number(channelId));
    if (
      this.channelStorage.getUserRole(safeChannelId, req.user.userId) !==
      'owner'
    ) {
      throw new ForbiddenException(`This user is not an owner of the channel`);
    }
    return true;
  }
}
