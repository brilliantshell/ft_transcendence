import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { ChannelStorage } from '../../user-status/channel.storage';
import { VerifiedRequest } from '../..//util/type';

@Injectable()
export class ChannelExistGuard implements CanActivate {
  private readonly CHANNEL_ID_MIN = 1;
  private readonly CHANNEL_ID_MAX = 2147483647;

  constructor(private readonly channelStorage: ChannelStorage) {}

  canActivate(context: ExecutionContext): boolean {
    const { channelId } = context
      .switchToHttp()
      .getRequest<VerifiedRequest>().params;
    const safeChannelId =
      typeof channelId === 'string' &&
      /^[1-9]\d{0,9}$/.test(channelId) &&
      Math.floor(Number(channelId));
    if (
      !safeChannelId ||
      safeChannelId < this.CHANNEL_ID_MIN ||
      safeChannelId > this.CHANNEL_ID_MAX
    ) {
      throw new BadRequestException('Invalid Channel Id');
    }
    if (this.channelStorage.getChannel(safeChannelId) === undefined) {
      throw new NotFoundException(`Channel (${channelId}) does not exist`);
    }
    return true;
  }
}
