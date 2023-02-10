import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { EntityNotFoundError, Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { join } from 'path';
import { rmSync } from 'fs';

import { Achievers } from '../entity/achievers.entity';
import { MatchHistory } from '../entity/match-history.entity';
import { Users } from '../entity/users.entity';
import { UserId } from '../util/type';

@Injectable()
export class ProfileService {
  private readonly logger: Logger = new Logger(ProfileService.name);

  constructor(
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
          relations: { achievement: true },
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
      // Postgres unique_violation error code
      if (e.code === '23505') {
        throw new ConflictException(`Nickname (${nickname}) already exists`);
      }
      this.logger.error(e);
      throw new InternalServerErrorException('Failed to update user nickname');
    }
  }

  /**
   * @description 유저의 2FA email 을 반환
   *
   * @param userId 유저의 ID
   * @returns 유저의 2FA email
   */
  async findTwoFactorEmail(userId: UserId) {
    try {
      return {
        email: (
          await this.usersRepository.findOneOrFail({
            where: { userId },
            select: ['authEmail'],
          })
        ).authEmail,
      };
    } catch (e) {
      this.logger.error(e);
      throw e instanceof EntityNotFoundError
        ? new NotFoundException('Two-factor Authentication is not enabled')
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
      // Postgres unique_violation error code
      if (e.code === '23505') {
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

  /**
   * @description 유저의 프로필 이미지 경로 업데이트
   *
   * @param userId 유저의 ID
   * @param profileImage 변경된 프로필 이미지 경로
   */
  async updateProfileImage(userId: UserId, profileImage: string) {
    try {
      await this.usersRepository.update(userId, { profileImage });
    } catch (e) {
      this.logger.error(e);
      throw new InternalServerErrorException(
        'Failed to update user profileImage',
      );
    }
  }

  /**
   * @description 유저의 프로필 이미지 초기화
   *
   * @param userId 유저의 ID
   */
  async deleteProfileImage(userId: UserId) {
    try {
      await this.usersRepository.update(userId, {
        profileImage: null,
      });
      rmSync(join(__dirname, `../../asset/profile/${userId}`), {
        recursive: true,
        force: true,
      });
    } catch (e) {
      this.logger.error(e);
      throw new InternalServerErrorException(
        'Failed to delete user profileImage',
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
      await this.matchHistoryRepository.find({
        where: [{ userOneId: userId }, { userTwoId: userId }],
        relations: ['userOne', 'userTwo'],
        select: {
          userOneScore: true,
          userTwoScore: true,
          endAt: true as any,
          isRank: true,
          userOne: { nickname: true },
          userTwo: { nickname: true },
        },
      })
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
