import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Cache } from 'cache-manager';
import { DataSource } from 'typeorm';
import { DateTime } from 'luxon';
import { MailerService } from '@nestjs-modules/mailer';
import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';

import {
  ACHIEVEMENTS_ENTITIES,
  generateAchievers,
  generateMatchHistory,
  generateUsers,
  updateUsersFromMatchHistory,
} from '../../test/util/generate-mock-data';
import { AccessMode, Channels } from '../entity/channels.entity';
import { Achievements } from '../entity/achievements.entity';
import { Achievers } from '../entity/achievers.entity';
import { AppModule } from '../app.module';
import { AuthService } from '../auth/auth.service';
import { ChannelMembers } from '../entity/channel-members.entity';
import { Friends } from '../entity/friends.entity';
import { MatchHistory } from '../entity/match-history.entity';
import { ProfileService } from './profile.service';
import {
  TYPEORM_SHARED_CONFIG,
  createDataSources,
  destroyDataSources,
} from '../../test/util/db-resource-manager';
import { TwoFactorAuthData } from 'src/util/type';
import { Users } from '../entity/users.entity';

const TEST_DB = 'test_db_profile_service';
const ENTITIES = [
  Achievements,
  Achievers,
  ChannelMembers,
  Channels,
  Friends,
  MatchHistory,
  Users,
];

describe('ProfileService', () => {
  let dataSource: DataSource;
  let initDataSource: DataSource;
  let service: ProfileService;
  let achievementsEntities: Achievements[];
  let achieversEntities: Achievers[];
  let matchHistoryEntities: MatchHistory[];
  let usersEntities: Users[];
  let authService: AuthService;
  let cacheManager: Cache;

  beforeAll(async () => {
    const dataSources = await createDataSources(TEST_DB, ENTITIES);
    initDataSource = dataSources.initDataSource;
    dataSource = dataSources.dataSource;
    usersEntities = generateUsers(30);
    await dataSource.getRepository(Users).insert(usersEntities);
    achievementsEntities = await dataSource
      .getRepository(Achievements)
      .save(ACHIEVEMENTS_ENTITIES);
    achieversEntities = generateAchievers(usersEntities, achievementsEntities);
    await dataSource.getRepository(Achievers).save(achieversEntities);
    matchHistoryEntities = generateMatchHistory(usersEntities);
    matchHistoryEntities = await dataSource
      .getRepository(MatchHistory)
      .save(matchHistoryEntities);
    updateUsersFromMatchHistory(usersEntities, matchHistoryEntities);
    await dataSource.getRepository(Users).save(usersEntities);
  });

  afterAll(() => {
    destroyDataSources(TEST_DB, dataSource, initDataSource);
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'postgres',
          ...TYPEORM_SHARED_CONFIG,
          autoLoadEntities: true,
          database: TEST_DB,
        }),
        TypeOrmModule.forFeature(ENTITIES),
        AppModule,
      ],
    }).compile();

    const mailerService = module.get<MailerService>(MailerService);
    jest
      .spyOn(mailerService, 'sendMail')
      .mockImplementation(() => Promise.resolve());
    service = module.get<ProfileService>(ProfileService);
    authService = module.get<AuthService>(AuthService);
    cacheManager = (authService as any).cacheManager;
  });

  it('should be defined', async () => {
    expect(service).toBeDefined();
  });

  it('should find user profile', async () => {
    const user = usersEntities[0];
    const { ladder, winCount, lossCount } = await dataSource
      .getRepository(Users)
      .findOne({
        where: { userId: user.userId },
        select: ['ladder', 'winCount', 'lossCount'],
      });
    const winLossTotal = [winCount, lossCount];
    const achievement = (
      await dataSource.getRepository(Achievers).find({
        where: { userId: user.userId },
        relations: {
          achievement: true,
        },
      })
    ).map((e) => e.achievement);
    const matchHistoryRaw = (
      await dataSource.getRepository(MatchHistory).find({
        where: [{ userOneId: user.userId }, { userTwoId: user.userId }],
        relations: ['userOne', 'userTwo'],
        select: {
          matchId: true,
          userOneScore: true,
          userTwoScore: true,
          endAt: true as any,
          isRank: true,
          userOne: { nickname: true, isDefaultImage: true, userId: true },
          userTwo: { nickname: true, isDefaultImage: true, userId: true },
        },
      })
    ).sort((a, b) => b.endAt.valueOf() - a.endAt.valueOf());
    let start = DateTime.now().valueOf();
    for (const { endAt } of matchHistoryRaw) {
      if (start < endAt.valueOf()) {
        fail('sort error');
      }
      start = endAt.valueOf();
    }

    const matchHistory = matchHistoryRaw.map((e) => {
      return e.userOneScore > e.userTwoScore
        ? {
            matchId: e.matchId,
            winner: e.userOne,
            loser: e.userTwo,
            score: [e.userOneScore, e.userTwoScore],
            isRank: e.isRank,
          }
        : {
            matchId: e.matchId,
            winner: e.userTwo,
            loser: e.userOne,
            score: [e.userTwoScore, e.userOneScore],
            isRank: e.isRank,
          };
    });
    const ret = {
      ladder,
      achievement,
      winLossTotal,
      matchHistory,
    };
    expect(await service.findProfile(user.userId)).toEqual(ret);
  });

  it('should find user profile when user do not have achievement and matchHistory', async () => {
    const user = generateUsers(1)[0];
    await dataSource.getRepository(Users).insert({
      userId: user.userId,
      nickname: user.nickname,
      authEmail: user.authEmail,
    });
    const { ladder, winCount, lossCount } = await dataSource
      .getRepository(Users)
      .findOne({
        where: { userId: user.userId },
        select: ['ladder', 'winCount', 'lossCount'],
      });
    const winLossTotal = [winCount, lossCount];
    const achievement = (
      await dataSource.getRepository(Achievers).find({
        where: { userId: user.userId },
        relations: {
          achievement: true,
        },
      })
    ).map((e) => e.achievement);
    const matchHistoryRaw = await dataSource
      .createQueryBuilder(MatchHistory, 'MatchHistory')
      .leftJoin('MatchHistory.userOne', 'UserOne')
      .leftJoin('MatchHistory.userTwo', 'UserTwo')
      .select([
        'MatchHistory.userOneScore',
        'MatchHistory.userTwoScore',
        'MatchHistory.isRank',
        'UserOne.nickname',
        'UserTwo.nickname',
      ])
      .where('MatchHistory.userOneId = :id')
      .orWhere('MatchHistory.userTwoId = :id')
      .setParameter('id', user.userId)
      .getMany();
    const matchHistory = matchHistoryRaw.map((e) => {
      return e.userOneScore > e.userTwoScore
        ? {
            winner: e.userOne,
            loser: e.userTwo,
            score: [e.userOneScore, e.userTwoScore],
            isRank: e.isRank,
          }
        : {
            winner: e.userTwo,
            loser: e.userOne,
            score: [e.userTwoScore, e.userOneScore],
            isRank: e.isRank,
          };
    });
    const ret = {
      ladder,
      achievement,
      winLossTotal,
      matchHistory,
    };
    expect(await service.findProfile(user.userId)).toEqual(ret);
  });

  it('should update user nickname', async () => {
    const user = usersEntities[0];
    const prevNickname = user.nickname;
    const nickname = 'newNIname';
    await service.updateNickname(user.userId, nickname);
    const ret = await dataSource.getRepository(Users).findOne({
      where: { userId: user.userId },
      select: ['nickname'],
    });
    expect(ret.nickname).toEqual(nickname);

    await service.updateNickname(user.userId, prevNickname);
  });

  it('should throw conflict exception when request nickname is duplicated', async () => {
    const user = usersEntities[0];
    const userTwo = usersEntities[1];
    await expect(
      async () => await service.updateNickname(user.userId, userTwo.nickname),
    ).rejects.toThrowError(ConflictException);
  });

  it('should find 2FA email', async () => {
    const user = usersEntities[0];
    const ret = await service.findTwoFactorEmail(user.userId);
    expect(ret).toEqual({ email: user.authEmail });
  });

  it('should throw 404 when 2FA disabled (no authEmail)', async () => {
    const [user] = generateUsers(1);
    delete user.authEmail;
    await dataSource.getRepository(Users).insert(user);
    expect(
      async () => await service.findTwoFactorEmail(user.userId),
    ).rejects.toThrowError(NotFoundException);
  });

  it('should update 2FA email (did not have a 2FA email)', async () => {
    const [user] = generateUsers(1);
    delete user.authEmail;
    await dataSource.getRepository(Users).insert(user);
    expect(
      async () => await service.findTwoFactorEmail(user.userId),
    ).rejects.toThrowError(NotFoundException);
    const newEmail = 'twofactor@example.com';
    await service.verifyTwoFactorEmail(user.userId, newEmail);
    const data: TwoFactorAuthData = await cacheManager.get(
      user.userId.toString(),
    );
    expect(data.email).toEqual(newEmail);
    const email = await service.verifyTwoFactorCode(user.userId, data.authCode);
    await service.updateTwoFactorEmail(user.userId, email);
    expect(await service.findTwoFactorEmail(user.userId)).toEqual({
      email: newEmail,
    });
    await dataSource.getRepository(Users).delete(user.userId);
  });

  it('should update 2FA email (had a valid 2FA email', async () => {
    const [user] = generateUsers(1);
    await dataSource.getRepository(Users).insert(user);
    const newEmail = 'twofactor@example.com';
    await service.verifyTwoFactorEmail(user.userId, newEmail);
    const data: TwoFactorAuthData = await cacheManager.get(
      user.userId.toString(),
    );
    expect(data.email).toEqual(newEmail);
    const email = await service.verifyTwoFactorCode(user.userId, data.authCode);
    await service.updateTwoFactorEmail(user.userId, email);
    expect(await service.findTwoFactorEmail(user.userId)).toEqual({
      email: newEmail,
    });
    await dataSource.getRepository(Users).delete(user.userId);
  });

  it('should not update 2FA email (incorrect auth code)', async () => {
    const [user] = generateUsers(1);
    await dataSource.getRepository(Users).insert(user);
    const newEmail = 'twofactor@example.com';
    await service.verifyTwoFactorEmail(user.userId, newEmail);
    const data: TwoFactorAuthData = await cacheManager.get(
      user.userId.toString(),
    );
    expect(data.email).toEqual(newEmail);
    await expect(
      async () =>
        await service.verifyTwoFactorCode(user.userId, data.authCode + '1'),
    ).rejects.toThrowError(ForbiddenException);
    await dataSource.getRepository(Users).delete(user.userId);
  });

  it('should throw exception when 2FA email is duplicated', async () => {
    const [userOne, userTwo] = usersEntities;
    await expect(
      async () =>
        await service.verifyTwoFactorEmail(userOne.userId, userTwo.authEmail),
    ).rejects.toThrowError(ConflictException);
  });

  it('should throw exception when try confirm email without verification', async () => {
    const [user] = generateUsers(1);
    delete user.authEmail;
    await dataSource.getRepository(Users).insert(user);
    await expect(
      async () => await service.verifyTwoFactorCode(user.userId, '123456'),
    ).rejects.toThrowError(NotFoundException);
  });

  it('should delete 2FA email', async () => {
    const user = usersEntities[0];
    await service.deleteTwoFactorEmail(user.userId);
    await expect(
      async () => await service.findTwoFactorEmail(user.userId),
    ).rejects.toThrowError(NotFoundException);
  });

  it('should delete 2FA email (call twice)', async () => {
    const user = usersEntities[0];
    await service.deleteTwoFactorEmail(user.userId);
    await service.deleteTwoFactorEmail(user.userId);
  });

  it('should update Achievements 1, 2, 3, 5', async () => {
    const user = await dataSource.getRepository(Users).save({
      userId: 4242,
      nickname: 'test',
      ladder: 10000,
      winCount: 10000,
    });
    for (let i = 0; i < 5; ++i) {
      const a = await dataSource.getRepository(Channels).save({
        name: `test${i}`,
        ownerId: user.userId,
        accessMode: AccessMode.PUBLIC,
        memberCount: 1,
        modifiedAt: DateTime.now(),
      });
      await dataSource.getRepository(ChannelMembers).save({
        channelId: a.channelId,
        memberId: user.userId,
        viewedAt: DateTime.now(),
        muteEndAt: DateTime.now(),
      });
    }
    for (let i = 0; i < 10; ++i) {
      await dataSource.getRepository(Friends).save({
        senderId: user.userId,
        receiverId: usersEntities[i].userId,
        isAccepted: true,
      });
    }
    expect(
      (
        await dataSource
          .getRepository(Achievers)
          .find({ where: { userId: user.userId }, relations: ['achievement'] })
      ).map((a) => a.achievement),
    ).toEqual([]);

    const ret = await service.findProfile(user.userId);

    expect(ret.achievement.length).toEqual(4);

    expect(
      (
        await dataSource
          .getRepository(Achievers)
          .find({ where: { userId: user.userId }, relations: ['achievement'] })
      ).map((a) => a.achievement),
    ).toEqual(ret.achievement);
  });
});
