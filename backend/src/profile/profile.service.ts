import {
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { EntityNotFoundError, In, MoreThan, Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { join } from 'path';
import { rmSync } from 'fs';

import { Achievements } from '../entity/achievements.entity';
import { Achievers } from '../entity/achievers.entity';
import { AuthService } from '../auth/auth.service';
import { ChannelMembers } from '../entity/channel-members.entity';
import { Friends } from '../entity/friends.entity';
import { MatchHistory } from '../entity/match-history.entity';
import { Users } from '../entity/users.entity';
import { UserId } from '../util/type';

@Injectable()
export class ProfileService {
  private readonly logger: Logger = new Logger(ProfileService.name);

  constructor(
    @InjectRepository(Achievers)
    private readonly achieversRepository: Repository<Achievers>,
    @InjectRepository(Achievements)
    private readonly achievementsRepository: Repository<Achievements>,
    private readonly authService: AuthService,
    @InjectRepository(ChannelMembers)
    private readonly channelMembersRepository: Repository<ChannelMembers>,
    @InjectRepository(Friends)
    private readonly friendsRepository: Repository<Friends>,
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
      const achievedId = (
        await this.achieversRepository.find({
          where: { userId: targetId },
          select: { achievementId: true },
        })
      ).map(({ achievementId }) => achievementId);
      const updatedIds = await this.updateAchievements(
        targetId,
        winCount,
        ladder,
        achievedId,
      );
      const achievement = await this.achievementsRepository.findBy({
        id: In(updatedIds),
      });
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
      await this.usersRepository.update(userId, { isDefaultImage: false });
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
      await this.usersRepository.update(userId, { isDefaultImage: true });
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
          userOne: { nickname: true, userId: true, isDefaultImage: true },
          userTwo: { nickname: true, userId: true, isDefaultImage: true },
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
              winner: userOne,
              loser: userTwo,
              score: [userOneScore, userTwoScore],
              isRank,
            }
          : {
              matchId,
              winner: userTwo,
              loser: userOne,
              score: [userTwoScore, userOneScore],
              isRank,
            };
      });
  }

  /*****************************************************************************
   *                                                                           *
   * SECTION : update achievements                                             *
   *                                                                           *
   ****************************************************************************/

  /**
   * @description 프로필을 조회할 때 업적 업데이트
   *
   * @param targetId 조회 대상 유저의 ID
   * @param winCount 조회 대상 유저의 승리 횟수
   * @param ladder 조회 대상 유저의 래더
   * @param achievedIds 조회 대상 유저가 이미 달성한 업적의 ID
   * @returns
   */
  private async updateAchievements(
    targetId: UserId,
    winCount: number,
    ladder: number,
    achievedIds: number[],
  ) {
    const achievementsList: Array<[number, () => Promise<boolean>]> = [
      [1, this.updateFirstWin.bind(this, targetId, winCount)],
      [2, this.updateTopPlayer.bind(this, targetId, ladder)],
      [3, this.updateTenFriends.bind(this, targetId)],
      [5, this.updateFiveJoinedChats.bind(this, targetId)],
    ];
    const toUpdate = achievementsList.filter(([a]) => !achievedIds.includes(a));
    await Promise.all(
      toUpdate.map(([i, func]) =>
        func().then((updated) => {
          updated && achievedIds.push(i);
        }),
      ),
    );
    return achievedIds.sort((a, b) => a - b);
  }

  /**
   * @description 업적 #1 달성 여부 업데이트
   *
   * @param targetId 조회 대상 유저의 ID
   * @param winCount 조회 대상 유저의 승리 횟수
   * @returns
   */
  private async updateFirstWin(targetId: UserId, winCount: number) {
    try {
      if (winCount >= 1) {
        await this.achieversRepository.insert({
          userId: targetId,
          achievementId: 1,
        });
        return true;
      }
      return false;
    } catch (e) {
      this.logger.error(e);
      throw new InternalServerErrorException('Failed to update achievement #1');
    }
  }

  /**
   * @description 업적 #2 달성 여부 업데이트
   *
   * @param targetId 조회 대상 유저의 ID
   * @param ladder 조회 대상 유저의 래더
   * @returns 업데이트 여부
   */
  private async updateTopPlayer(targetId: UserId, ladder: number) {
    try {
      if (
        (await this.usersRepository.countBy({ ladder: MoreThan(ladder) })) === 0
      ) {
        await this.achieversRepository.insert({
          userId: targetId,
          achievementId: 2,
        });
        return true;
      }
      return false;
    } catch (e) {
      this.logger.error(e);
      throw new InternalServerErrorException('Failed to update achievement #2');
    }
  }

  /**
   * @description 업적 #3 달성 여부 업데이트
   *
   * @param targetId 조회 대상 유저의 ID
   * @returns 업데이트 여부
   */
  private async updateTenFriends(targetId: UserId) {
    try {
      if (
        (await this.friendsRepository.countBy([
          { senderId: targetId, isAccepted: true },
          { receiverId: targetId, isAccepted: true },
        ])) >= 10
      ) {
        this.achieversRepository.insert({
          userId: targetId,
          achievementId: 3,
        });
        return true;
      }
      return false;
    } catch (e) {
      this.logger.error(e);
      throw new InternalServerErrorException('Failed to update achievement #3');
    }
  }

  /**
   * @description 업적 #5 달성 여부 업데이트
   *
   * @param targetId 조회 대상 유저의 ID
   * @returns 업데이트 여부
   */
  private async updateFiveJoinedChats(targetId: UserId) {
    try {
      if (
        (await this.channelMembersRepository.countBy({ memberId: targetId })) >=
        5
      ) {
        await this.achieversRepository.insert({
          userId: targetId,
          achievementId: 5,
        });
        return true;
      }
      return false;
    } catch (e) {
      this.logger.error(e);
      throw new InternalServerErrorException('Failed to update achievement #5');
    }
  }
}
