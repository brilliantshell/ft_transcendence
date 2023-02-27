import { InjectRepository } from '@nestjs/typeorm';
import {
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Like, Repository } from 'typeorm';

import { Users } from '../entity/users.entity';

@Injectable()
export class SearchService {
  private readonly logger = new Logger(SearchService.name);

  constructor(
    @InjectRepository(Users)
    private readonly usersRepository: Repository<Users>,
  ) {}

  async find(value: string) {
    try {
      const result = await this.usersRepository.find({
        where: {
          nickname: Like(`${value}%`),
        },
        take: 20,
        select: ['userId', 'nickname', 'isDefaultImage'],
      });
      if (result.length === 0) {
        throw new NotFoundException('No user found');
      }
      return result;
    } catch (e) {
      if (e instanceof NotFoundException) {
        throw e;
      }
      this.logger.error(e);
      throw new InternalServerErrorException('Failed to search user');
    }
  }
}
