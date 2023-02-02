import {
  CanActivate,
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

import { UserId } from '../util/type';
import { UserRelationshipStorage } from '../user-status/user-relationship.storage';
import { Users } from '../entity/users.entity';

@Injectable()
export class UserGuard implements CanActivate {
  private readonly logger: Logger = new Logger(UserGuard.name);
  constructor(
    @InjectRepository(Users)
    private readonly usersRepository: Repository<Users>,
    private readonly userRelationshipStorage: UserRelationshipStorage,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req: Request = context.switchToHttp().getRequest();
    if (req.params['userId']) {
      const userId = Math.floor(Number(req.params['userId']));
      await this.checkIfUserExists(userId);
    }
    return true;
  }

  private async checkIfUserExists(userId: UserId) {
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
  }
}
