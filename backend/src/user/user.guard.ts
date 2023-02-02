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
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Relationship } from '../util/type';
import { UserId, VerifiedRequest } from '../util/type';
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

  /*****************************************************************************
   *                                                                           *
   * SECTION : Public methods                                                  *
   *                                                                           *
   ****************************************************************************/

  /**
   * @description UserController 로 오는 요청들의 권한 및 유효성 검증
   *
   * @param context ExecutionContext
   * @returns Promise<boolean> true 면 요청 처리
   */
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req: VerifiedRequest = context.switchToHttp().getRequest();
    const { method, path } = req;
    if (req.params['userId']) {
      const paramId = Math.floor(Number(req.params['userId']));
      await this.checkIfUserExists(paramId);
      const relationship = this.userRelationshipStorage.getRelationship(
        process.env.NODE_ENV === 'development'
          ? Math.floor(Number(req.headers['x-user-id']))
          : req.user.userId,
        paramId,
      );
      if (!path.endsWith('info') && relationship === 'blocked') {
        throw new ForbiddenException('The user is blocked');
      }
      method === 'DELETE' && this.checkDeleteNotFound(path, relationship);
      path.endsWith('friend') &&
        this.checkFriendBadRequest(method, relationship);
    }
    return true;
  }

  /*****************************************************************************
   *                                                                           *
   * SECTION : Private methods                                                 *
   *                                                                           *
   ****************************************************************************/

  /**
   * @description :userId 가 존재하는 유저의 id 인지 확인
   *
   * @param paramId :userId
   */
  private async checkIfUserExists(paramId: UserId) {
    try {
      if (!(await this.usersRepository.exist({ where: { userId: paramId } }))) {
        throw new NotFoundException("The user doesn't exist");
      }
    } catch (e) {
      this.logger.error(e);
      throw e instanceof NotFoundException
        ? e
        : new InternalServerErrorException("Failed to check user's existence");
    }
  }

  /**
   * @description 존재하지 않는 관계를 삭제하려하는지 확인
   *
   * @param path request 경로
   * @param relationship :userId 와 요청한 유저의 관계
   */
  private checkDeleteNotFound(path: string, relationship: Relationship) {
    if (path.endsWith('block') && relationship !== 'blocker') {
      throw new NotFoundException('The user had not blocked the other user');
    }
    if (
      path.endsWith('friend') &&
      !['friend', 'pendingSender', 'pendingReceiver'].includes(relationship)
    ) {
      throw new NotFoundException(
        'The user had not received/sent a friend request nor been friends with the other user',
      );
    }
  }

  /**
   * @description 특정 행동을 할 수 없는 관계인데 실행하려고 하는 케이스 확인
   *
   * @param method request method
   * @param relationship :userId 와 요청한 유저의 관계
   */
  private checkFriendBadRequest(method: string, relationship: Relationship) {
    if (relationship === 'blocker') {
      throw new BadRequestException(
        'The user need to unblock the other user first in order to become friends',
      );
    }
    if (
      method === 'PUT' && [
        relationship === 'friend' || relationship === 'pendingReceiver',
      ]
    ) {
      throw new BadRequestException(
        'The user had already received a friend request from or been friends with the other user',
      );
    }
    if (method === 'PATCH' && relationship === 'pendingSender') {
      throw new BadRequestException(
        'The sender of a friend request cannot accept it',
      );
    }
  }
}
