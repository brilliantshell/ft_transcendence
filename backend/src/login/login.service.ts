import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Achievers } from '../entity/achievers.entity';
import { UserId } from '../util/type';
import { Users } from '../entity/users.entity';

@Injectable()
export class LoginService {
  private readonly logger = new Logger(LoginService.name);

  constructor(
    @InjectRepository(Achievers)
    private readonly achieversRepository: Repository<Achievers>,
    @InjectRepository(Users)
    private readonly usersRepository: Repository<Users>,
  ) {}

  async createUserInfo(
    userId: UserId,
    nickname: string,
    isDefaultImage: boolean,
  ) {
    try {
      await this.usersRepository.insert({ userId, nickname, isDefaultImage });
      const usersCount = await this.usersRepository.count();
      if (usersCount === 42) {
        await this.achieversRepository.insert({ userId, achievementId: 4 });
      }
    } catch (e) {
      this.logger.error(e);
      throw new InternalServerErrorException(
        `Failed to create user (${userId})`,
      );
    }
  }
}
