import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { RelationshipRequest } from '../../util/type';
import { Users } from '../../entity/users.entity';

@Injectable()
export class UserExistGuard implements CanActivate {
  private readonly logger: Logger = new Logger(UserExistGuard.name);
  constructor(
    @InjectRepository(Users)
    private readonly usersRepository: Repository<Users>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req: RelationshipRequest = context.switchToHttp().getRequest();
    if (
      req.targetId === undefined &&
      !/^[1-9][0-9]{4,5}$/.test(req.params.userId)
    ) {
      throw new BadRequestException('UserId must be between 10000 and 999999');
    }
    req.targetId = Math.floor(Number(req.params.userId));
    if (process.env.NODE_ENV === 'development' && req.user === undefined) {
      req.user = { userId: Math.floor(Number(req.headers['x-user-id'])) };
    }
    try {
      if (
        !(await this.usersRepository.exist({
          where: { userId: req.targetId },
        }))
      ) {
        throw new NotFoundException(
          `The user with the id (${req.targetId}) doesn't exist`,
        );
      }
    } catch (e) {
      this.logger.error(e);
      throw e instanceof NotFoundException
        ? e
        : new InternalServerErrorException(
            `Failed to check user's existence for id(${req.targetId})`,
          );
    }
    return true;
  }
}
