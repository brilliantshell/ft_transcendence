import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Request } from 'express';

import { ChannelStorage } from '../../user-status/channel.storage';

@Injectable()
export class ChannelExistGuard implements CanActivate {
  constructor(private readonly channelStorage: ChannelStorage) {}
  canActivate(context: ExecutionContext): boolean {
    const { channelId } = context.switchToHttp().getRequest<Request>().params;
    const safeChannelId =
      /^[1-9]\d{0,9}$/.test(channelId) && Math.floor(Number(channelId));
    if (!safeChannelId || safeChannelId < 1 || safeChannelId > 2147483647) {
      throw new BadRequestException('Invalid Channel Id');
    }
    if (this.channelStorage.getChannel(safeChannelId) === undefined) {
      throw new NotFoundException(`Channel (${channelId}) does not exist`);
    }
    return true;
  }
}
