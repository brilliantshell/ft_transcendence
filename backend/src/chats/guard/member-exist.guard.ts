import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';

import { ChannelStorage } from '../../user-status/channel.storage';
import { VerifiedRequest } from '../../util/type';

@Injectable()
export class MemberExistGuard implements CanActivate {
  constructor(private readonly channelStorage: ChannelStorage) {}
  canActivate(context: ExecutionContext): boolean {
    const Request = context.switchToHttp().getRequest<VerifiedRequest>();
    const { channelId } = Request.params;
    const { userId } = Request.user;
    if (!this.channelStorage.getUserRole(parseInt(channelId, 10), userId)) {
      throw new ForbiddenException('You are not a member of the channel');
    }
    return true;
  }
}
