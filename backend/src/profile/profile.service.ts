import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { UserId } from 'src/util/type';
import { Repository } from 'typeorm';

import { Achievements } from '../entity/achievements.entity';
import { Achievers } from '../entity/achievers.entity';
import { MatchHistory } from '../entity/match-history.entity';
import { Users } from '../entity/users.entity';

@Injectable()
export class ProfileService {
  private readonly logger: Logger = new Logger(ProfileService.name);
  constructor(
    @InjectRepository(Achievements)
    private readonly achievementsRepository: Repository<Achievements>,
    @InjectRepository(Achievers)
    private readonly achieversRepository: Repository<Achievers>,
    @InjectRepository(MatchHistory)
    private readonly matchHistoryRepository: Repository<MatchHistory>,
    @InjectRepository(Users)
    private readonly usersRepository: Repository<Users>,
  ) {}

  /*****************************************************************************
   *                                                                           *
   * SECTION : Public Methods                                                  *
   *                                                                           *
   ****************************************************************************/

  /*****************************************************************************
   *                                                                           *
   * SECTION : Profile UI                                                      *
   *                                                                           *
   ****************************************************************************/

  /**
   * @description 유저의 프로필 정보를 반환
   *
   * @param targetId 프로필을 조회할 유저의 ID
   * @returns 유저의 프로필 정보
   */
  async findProfile(targetId: UserId) {
    try {
      const { ladder, winCount, lossCount } =
        await this.usersRepository.findOne({
          where: { userId: targetId },
          select: ['ladder', 'winCount', 'lossCount'],
        });
      const achievement = (
        await this.achieversRepository.find({
          where: { userId: targetId },
          relations: {
            achievement: true,
          },
        })
      ).map((e) => e.achievement);
      const matchHistory = await this.findMatchHistory(targetId);
      return {
        ladder,
        achievement,
        winLossTotal: [winCount, lossCount],
        matchHistory,
      };
    } catch (e) {
      this.logger.error(e);
      console.log(e);
      throw new InternalServerErrorException('Failed to find user profile');
    }
  }

  /*****************************************************************************
   *                                                                           *
   * SECTION : User Info CRUD                                                  *
   *                                                                           *
   ****************************************************************************/

  /**
   * @description 유저의 닉네임을 변경
   *
   * @param userId 유저의 ID
   * @param nickname 변경할 닉네임
   */
  async updateNickname(userId: UserId, nickname: string) {
    try {
      await this.usersRepository.update(userId, { nickname });
    } catch (e) {
      if (e.code === '23505' /** Postgres unique_violation error code */) {
        throw new ConflictException(`Nickname (${nickname}) already exists`);
      }
      this.logger.error(e);
      throw new InternalServerErrorException('Failed to update user nickname');
    }
  }

  // FIXME: 필요 없을 수 있음. DB 업데이트와 프사 업로드 과정이 transaction 처럼 작동해야함.
  // updateProfileImage(userId: UserId, profileImage: string) {
  //   try {
  //     return this.usersRepository.update(userId, { profileImage });
  //   } catch (e) {
  //     this.logger.error(e);
  //     throw new InternalServerErrorException(
  //       'Failed to update user profileImage',
  //     );
  //   }
  // }
  // deleteProfileImage(userId: UserId) {}

  /**
   * @description 유저의 2FA email 을 반환
   *
   * @param userId 유저의 ID
   * @returns 유저의 2FA email
   */
  async findTwoFactorEmail(userId: UserId) {
    try {
      const authEmail = (
        await this.usersRepository.findOne({
          where: { userId },
          select: ['authEmail'],
        })
      )?.authEmail;
      if (!authEmail) {
        throw new NotFoundException('Two-factor authentication is not enabled');
      }
      return { email: authEmail };
    } catch (e) {
      this.logger.error(e);
      throw e instanceof NotFoundException
        ? e
        : new InternalServerErrorException('Failed to find two-factor email');
    }
  }

  /**
   * @description 유저의 2FA email 을 변경
   *
   * @param userId 유저의 ID
   * @param email 변경할 2FA email
   */
  async updateTwoFactorEmail(userId: UserId, email: string) {
    try {
      await this.usersRepository.update(userId, {
        authEmail: email,
      });
    } catch (e) {
      if (e.code === '23505' /** Postgres unique_violation error code */) {
        throw new ConflictException(`Email (${email}) already exists`);
      }
      this.logger.error(e);
      throw new InternalServerErrorException(
        'Failed to update two-factor email',
      );
    }
  }

  /**
   * @description 유저의 2FA email 을 삭제
   *
   * @param userId 유저의 ID
   */
  async deleteTwoFactorEmail(userId: UserId) {
    try {
      await this.usersRepository.update(userId, {
        authEmail: null,
      });
      // TODO: NotFound 를 던질 지 고민해보기
    } catch (e) {
      this.logger.error(e);
      throw new InternalServerErrorException(
        'Failed to delete two-factor email',
      );
    }
  }

  /*****************************************************************************
   *                                                                           *
   * SECTION : Private Methods                                                 *
   *                                                                           *
   ****************************************************************************/

  /**
   * @description 유저의 전적을 반환
   *
   * @param userId 유저의 ID
   * @returns 유저의 전적
   */
  private async findMatchHistory(userId: UserId) {
    return (
      await this.matchHistoryRepository
        .createQueryBuilder('MatchHistory')
        .leftJoin('MatchHistory.userOne', 'UserOne')
        .leftJoin('MatchHistory.userTwo', 'UserTwo')
        .select([
          'MatchHistory.userOneScore',
          'MatchHistory.userTwoScore',
          'MatchHistory.isRank',
          'MatchHistory.endAt',
          'UserOne.nickname',
          'UserTwo.nickname',
        ])
        .where('MatchHistory.userOneId = :userId')
        .orWhere('MatchHistory.userTwoId = :userId')
        .setParameter('userId', userId)
        .getMany()
    )
      .sort((a, b) => b.endAt.valueOf() - a.endAt.valueOf())
      .map((e) => {
        const { userOne, userTwo, userOneScore, userTwoScore, isRank } = e;
        return userOneScore > userTwoScore
          ? {
              winner: userOne.nickname,
              loser: userTwo.nickname,
              score: [userOneScore, userTwoScore],
              isRank,
            }
          : {
              winner: userTwo.nickname,
              loser: userOne.nickname,
              score: [userTwoScore, userOneScore],
              isRank,
            };
      });
  }
}
