import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { ChannelStorage } from '../../user-status/channel.storage';
import { VerifiedRequest } from '../../util/type';

const CHANNEL_ID_MIN = 1;
const CHANNEL_ID_MAX = 2147483647;

@Injectable()
export class ChannelExistGuard implements CanActivate {
  constructor(private readonly channelStorage: ChannelStorage) {}

  canActivate(context: ExecutionContext): boolean {
    const { channelId } = context
      .switchToHttp()
      .getRequest<VerifiedRequest>().params;
    const safeChannelId =
      /^[1-9]\d{0,9}$/.test(channelId) && Math.floor(Number(channelId));
    if (safeChannelId < CHANNEL_ID_MIN || safeChannelId > CHANNEL_ID_MAX) {
      throw new BadRequestException('Invalid Channel Id');
    }
    if (this.channelStorage.getChannel(safeChannelId) === undefined) {
      throw new NotFoundException(`Channel (${channelId}) does not exist`);
    }
    return true;
  }
}
