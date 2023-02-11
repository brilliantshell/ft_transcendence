import { InjectRepository } from '@nestjs/typeorm';
import {
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Repository } from 'typeorm';

import { UserId } from '../util/type';
import { Users } from '../entity/users.entity';

@Injectable()
export class RanksService {
  private readonly logger = new Logger(RanksService.name);

  constructor(
    @InjectRepository(Users)
    private readonly usersRepository: Repository<Users>,
  ) {}

  // TODO PIPE 로 range 검증
  /**
   * @description offset 부터 limit 만큼 유저의 id 와 ladder 를 랭킹 순으로 나열
   *
   * @param offset 시작 index
   * @param limit 반환할 유저 수
   * @returns 랭킹 순으로 나열된 유저들의 id 와 ladder
   */
  async findLadders(offset: number, limit: number) {
    try {
      const users = await this.usersRepository
        .createQueryBuilder()
        .select('user_id', 'id')
        .addSelect('ladder')
        .addSelect('RANK() OVER (ORDER BY ladder DESC)::INTEGER', 'rank')
        .offset(offset)
        .limit(limit)
        .getRawMany();
      if (users.length === 0) {
        throw new NotFoundException(`No users from offset=${offset}`);
      }
      return { users };
    } catch (e) {
      this.logger.error(e);
      throw e instanceof NotFoundException
        ? e
        : new InternalServerErrorException(
            `Failed to find ladders of ${limit} users from offset=${offset}`,
          );
    }
  }

  /**
   * @description 요청한 유저의 랭킹과 전체 유저 수를 반환
   *
   * @param userId 요청한 유저의 id
   * @returns 요청한 유저의 랭킹과 전체 유저 수
   */
  async findPosition(userId: UserId) {
    const ranksCte = this.usersRepository
      .createQueryBuilder()
      .select('user_id')
      .addSelect('RANK() OVER (ORDER BY ladder DESC)::INTEGER', 'rank');
    try {
      const [{ rank }, total] = await Promise.all([
        this.usersRepository.manager
          .createQueryBuilder()
          .addCommonTableExpression(ranksCte, 'Ranks')
          .select('rank')
          .from('Ranks', 'Ranks')
          .where('user_id = :userId', { userId })
          .getRawOne(),
        this.usersRepository.count(),
      ]);
      return { myRank: Number(rank), total };
    } catch (e) {
      this.logger.error(e);
      throw new InternalServerErrorException(
        `Failed to find the ranking of the user ${userId}`,
      );
    }
  }
}
