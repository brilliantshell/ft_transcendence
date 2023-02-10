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
      throw new InternalServerErrorException();
    }
  }
}
