import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Like, Repository } from 'typeorm';

import { Users } from '../entity/users.entity';

@Injectable()
export class SearchService {
  private readonly logger = new Logger(SearchService.name);

  constructor(
    @InjectRepository(Users)
    private readonly usersRepository: Repository<Users>,
  ) {}

  find(value: string) {
    try {
      return this.usersRepository.find({
        where: {
          nickname: Like(`${value}%`),
        },
        take: 20,
        select: ['userId', 'nickname', 'isDefaultImage'],
      });
    } catch (e) {
      this.logger.error(e);
      throw new InternalServerErrorException('Failed to search user');
    }
  }
}
