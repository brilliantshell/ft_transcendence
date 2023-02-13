import { ConflictException, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { DateTime } from 'luxon';
import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';

import {
  ACHIEVEMENTS_ENTITIES,
  generateAchievers,
  generateMatchHistory,
  generateUsers,
  updateUsersFromMatchHistory,
} from '../../test/util/generate-mock-data';
import { Achievements } from '../entity/achievements.entity';
import { Achievers } from '../entity/achievers.entity';
import { MatchHistory } from '../entity/match-history.entity';
import { ProfileService } from './profile.service';
import { Users } from '../entity/users.entity';
import {
  TYPEORM_SHARED_CONFIG,
  createDataSources,
  destroyDataSources,
} from '../../test/util/db-resource-manager';

const TEST_DB = 'test_db_profile_service';
const ENTITIES = [Achievements, Achievers, MatchHistory, Users];

describe('ProfileService', () => {
  let dataSource: DataSource;
  let initDataSource: DataSource;
  let service: ProfileService;
  let achievementsEntities: Achievements[];
  let achieversEntities: Achievers[];
  let matchHistoryEntities: MatchHistory[];
  let usersEntities: Users[];

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
        TypeOrmModule.forFeature([
          Achievements,
          Achievers,
          MatchHistory,
          Users,
        ]),
      ],
      providers: [ProfileService],
    }).compile();

    service = module.get<ProfileService>(ProfileService);
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
          userOneScore: true,
          userTwoScore: true,
          endAt: true as any,
          isRank: true,
          userOne: { nickname: true },
          userTwo: { nickname: true },
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
            winner: e.userOne.nickname,
            loser: e.userTwo.nickname,
            score: [e.userOneScore, e.userTwoScore],
            isRank: e.isRank,
          }
        : {
            winner: e.userTwo.nickname,
            loser: e.userOne.nickname,
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
            winner: e.userOne.nickname,
            loser: e.userTwo.nickname,
            score: [e.userOneScore, e.userTwoScore],
            isRank: e.isRank,
          }
        : {
            winner: e.userTwo.nickname,
            loser: e.userOne.nickname,
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
    await service.updateTwoFactorEmail(user.userId, newEmail);
    expect(await service.findTwoFactorEmail(user.userId)).toEqual({
      email: newEmail,
    });
    await dataSource.getRepository(Users).delete(user.userId);
  });

  it('should update 2FA email (had a valid 2FA email', async () => {
    const [user] = generateUsers(1);
    await dataSource.getRepository(Users).insert(user);
    const newEmail = 'twofactor@example.com';
    await service.updateTwoFactorEmail(user.userId, newEmail);
    expect(await service.findTwoFactorEmail(user.userId)).toEqual({
      email: newEmail,
    });
    await dataSource.getRepository(Users).delete(user.userId);
  });

  it('should throw exception when 2FA email is duplicated', async () => {
    const [userOne, userTwo] = usersEntities;
    await expect(
      async () =>
        await service.updateTwoFactorEmail(userOne.userId, userTwo.authEmail),
    ).rejects.toThrowError(ConflictException);
  });

  it('should delete 2FA email', async () => {
    const user = usersEntities[0];
    await service.deleteTwoFactorEmail(user.userId);
    await expect(
      async () => await service.findTwoFactorEmail(user.userId),
    ).rejects.toThrowError(NotFoundException);
    await service.updateTwoFactorEmail(user.userId, user.authEmail);
  });

  it('should delete 2FA email', async () => {
    const user = usersEntities[0];
    await service.deleteTwoFactorEmail(user.userId);
    await service.deleteTwoFactorEmail(user.userId);
  });
});
