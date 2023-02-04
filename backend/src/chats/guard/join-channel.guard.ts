import {
  BadRequestException,
  CanActivate,
  ConflictException,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Request } from 'express';

import { Users } from '../../entity/users.entity';
import { ChannelStorage } from '../../user-status/channel.storage';
import { ChannelId, UserId } from 'src/util/type';
import { DateTime } from 'luxon';

@Injectable()
export class JoinChannelGuard implements CanActivate {
  private readonly logger = new Logger(JoinChannelGuard.name);

  constructor(
    private readonly channelStorage: ChannelStorage,
    @InjectRepository(Users)
    private readonly usersRepository: Repository<Users>,
  ) {}

  async canActivate(context: ExecutionContext) {
    const { channelId, userId } = context
      .switchToHttp()
      .getRequest<Request>().params;
    if (typeof userId !== 'string' || !/^[1-9][0-9]{4,5}$/.test(userId)) {
      throw new BadRequestException('userId must be between 10000 and 999999');
    }
    const safeUserId = Math.floor(Number(userId));
    const safeChannelId = Math.floor(Number(channelId));

    await this.checkUserExist(safeUserId);
    await this.checkBanned(safeChannelId, safeUserId);
    this.checkUserInChannel(safeChannelId, safeUserId);
    return true;
  }

  private async checkUserExist(userId: UserId) {
    try {
      if (
        !(await this.usersRepository.exist({
          where: { userId },
        }))
      ) {
        throw new NotFoundException("The user doesn't exist");
      }
    } catch (e) {
      this.logger.error(e);
      throw e instanceof NotFoundException
        ? e
        : new InternalServerErrorException("Failed to check user's existence");
    }
  }

  private async checkBanned(channelId: ChannelId, userId: UserId) {
    if (
      (await this.channelStorage.getBanEndAt(channelId, userId)) >
      DateTime.now()
    ) {
      throw new ForbiddenException('You are banned');
    }
  }

  private checkUserInChannel(channelId: ChannelId, userId: UserId) {
    if (this.channelStorage.getUserRole(channelId, userId) !== null) {
      throw new ConflictException('You are already in the channel');
    }
  }
}
