import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  PipeTransform,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { UserId } from '../../util/type';
import { Users } from '../../entity/users.entity';

@Injectable()
export class ValidateUserIdPipe
  implements PipeTransform<string, Promise<UserId>>
{
  private readonly logger = new Logger(ValidateUserIdPipe.name);

  constructor(
    @InjectRepository(Users)
    private readonly usersRepository: Repository<Users>,
  ) {}

  async transform(value: string) {
    if (!/^[1-9][0-9]{4,5}$/.test(value)) {
      throw new BadRequestException('userId must be between 10000 and 999999');
    }
    const userId = Math.floor(Number(value));
    try {
      if (!(await this.usersRepository.exist({ where: { userId } }))) {
        throw new NotFoundException("The user doesn't exist");
      }
    } catch (e) {
      this.logger.error(e);
      throw e instanceof NotFoundException
        ? e
        : new InternalServerErrorException("Failed to check user's existence");
    }
    return userId;
  }
}
