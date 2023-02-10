import { InjectRepository } from '@nestjs/typeorm';
import {
  Injectable,
  InternalServerErrorException,
  Logger,
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
      return {
        users: await this.usersRepository.find({
          select: ['userId', 'ladder'],
          order: { ladder: 'DESC' },
          skip: offset,
          take: limit,
        }),
      };
    } catch (e) {
      this.logger.error(e);
      throw new InternalServerErrorException(
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
    const distinctLaddersEntity = this.usersRepository
      .createQueryBuilder()
      .select('ladder')
      .distinct(true);
    const ranksEntity = this.usersRepository.manager
      .createQueryBuilder()
      .select('ladder')
      .addSelect('ROW_NUMBER() OVER (ORDER BY ladder DESC)', 'rank')
      .from('distinctLadders', 'distinctLadders');
    try {
      const [{ rank }, total] = await Promise.all([
        this.usersRepository
          .createQueryBuilder()
          .addCommonTableExpression(distinctLaddersEntity, 'distinctLadders')
          .addCommonTableExpression(ranksEntity, 'ranks')
          .select('r.rank')
          .leftJoin('ranks', 'r', 'r.ladder = Users.ladder')
          .where('Users.user_id = :userId', { userId })
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
