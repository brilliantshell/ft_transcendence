import {
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { EntityNotFoundError, Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { join } from 'path';
import { rmSync } from 'fs';

import { Achievers } from '../entity/achievers.entity';
import { AuthService } from '../auth/auth.service';
import { MatchHistory } from '../entity/match-history.entity';
import { Users } from '../entity/users.entity';
import { UserId } from '../util/type';

@Injectable()
export class ProfileService {
  private readonly logger: Logger = new Logger(ProfileService.name);

  constructor(
    @InjectRepository(Achievers)
    private readonly achieversRepository: Repository<Achievers>,
    private readonly authService: AuthService,
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
        ? new NotFoundException(
            `Two-factor Authentication of a user(${userId}) is not enabled`,
          )
        : new InternalServerErrorException(
            `Failed to find Two-factor email of a user (${userId})`,
          );
    }
  }

  /**
   * @description 유저의 2FA email 검증 및 이메일 전송
   *
   * @param userId 유저의 ID
   * @param email 검증할 2FA email
   */
  async verifyTwoFactorEmail(userId: UserId, email: string) {
    let isConflict: boolean;
    try {
      isConflict = await this.usersRepository.exist({
        where: { authEmail: email },
      });
    } catch (e) {
      this.logger.error(e);
      throw new InternalServerErrorException(
        'Failed to check two-factor email exist',
      );
    }
    if (isConflict) {
      throw new ConflictException(`Email (${email}) already exists`);
    }
    await this.authService.sendTwoFactorCode(userId, email);
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
   * @description 유저의 2FA code 를 검증
   *
   * @param userId 유저의 ID
   * @param code 검증할 2FA code
   * @returns 검증된 2FA email
   */
  async verifyTwoFactorCode(userId: UserId, code: string) {
    try {
      return await this.authService.verifyTwoFactorCode(userId, code);
    } catch (e) {
      if (e instanceof NotFoundException) {
        throw e;
      }
      if (e instanceof UnauthorizedException) {
        throw new ForbiddenException('Incorrect two-factor code');
      }
      this.logger.error(e);
      throw new InternalServerErrorException('Failed to verify 2FA code');
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
   * @param isDefaultImage 변경된 프로필 이미지 경로
   */
  async updateProfileImage(userId: UserId) {
    try {
      await this.usersRepository.update(userId, { isDefaultImage: true });
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
      await this.usersRepository.update(userId, { isDefaultImage: false });
      rmSync(join(__dirname, `../../asset/profile-image/${userId}`), {
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
          matchId: true,
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
        const {
          matchId,
          userOne,
          userTwo,
          userOneScore,
          userTwoScore,
          isRank,
        } = e;
        return userOneScore > userTwoScore
          ? {
              matchId,
              winner: userOne.nickname,
              loser: userTwo.nickname,
              score: [userOneScore, userTwoScore],
              isRank,
            }
          : {
              matchId,
              winner: userTwo.nickname,
              loser: userOne.nickname,
              score: [userTwoScore, userOneScore],
              isRank,
            };
      });
  }
}
