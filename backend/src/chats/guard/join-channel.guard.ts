import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { DateTime } from 'luxon';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { ChannelId, UserId, VerifiedRequest } from '../../util/type';
import { ChannelStorage } from '../../user-status/channel.storage';
import { Users } from '../../entity/users.entity';
import { UserRelationshipStorage } from '../../user-status/user-relationship.storage';

@Injectable()
export class JoinChannelGuard implements CanActivate {
  private readonly logger = new Logger(JoinChannelGuard.name);

  constructor(
    private readonly channelStorage: ChannelStorage,
    private readonly userRelationshipStorage: UserRelationshipStorage,
    @InjectRepository(Users)
    private readonly usersRepository: Repository<Users>,
  ) {}

  async canActivate(context: ExecutionContext) {
    const { channelId, userId } = context
      .switchToHttp()
      .getRequest<VerifiedRequest>().params;
    if (!/^[1-9][0-9]{4,5}$/.test(userId)) {
      throw new BadRequestException('userId must be between 10000 and 999999');
    }
    const safeUserId = Math.floor(Number(userId));
    const safeChannelId = Math.floor(Number(channelId));

    if (
      this.userRelationshipStorage.isBlockedDm(safeChannelId) !== undefined &&
      !this.channelStorage.getChannel(safeChannelId).userRoleMap.has(safeUserId)
    ) {
      throw new ForbiddenException('Cannot join to DM channel');
    }

    await this.checkUserExist(safeUserId);
    await this.checkBanned(safeChannelId, safeUserId);
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
      throw new ForbiddenException(`The user (${userId}) is  banned`);
    }
  }
}
