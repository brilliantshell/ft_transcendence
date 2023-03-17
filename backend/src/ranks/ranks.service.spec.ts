import { DataSource } from 'typeorm';
import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { faker } from '@faker-js/faker';

import { RanksDto } from './dto/ranks.dto';
import { RanksService } from './ranks.service';
import {
  TYPEORM_SHARED_CONFIG,
  createDataSources,
  destroyDataSources,
} from '../../test/util/db-resource-manager';
import { Users } from '../entity/users.entity';
import { generateUsers } from '../../test/util/generate-mock-data';

const TEST_DB = 'test_db_ranks_service';
const ENTITIES = [Users];

describe('RanksService', () => {
  let service: RanksService;
  let dataSource: DataSource;
  let initDataSource: DataSource;
  let usersEntities: Users[];
  const length = faker.datatype.number({ min: 500, max: 1000 });
  const rankMap: Map<number, number> = new Map();

  beforeAll(async () => {
    const dataSources = await createDataSources(TEST_DB, ENTITIES);
    initDataSource = dataSources.initDataSource;
    dataSource = dataSources.dataSource;
    usersEntities = generateUsers(length).sort(
      (a: Users, b: Users) => b.ladder - a.ladder,
    );
    let curLadder = usersEntities[0].ladder;
    let rank = 1;
    let count = 0;
    usersEntities.forEach(({ userId, ladder }) => {
      if (curLadder > ladder) {
        curLadder = ladder;
        rank += count;
        count = 0;
      }
      rankMap.set(userId, rank);
      count++;
    });
    await dataSource.getRepository(Users).insert(usersEntities);
  });

  afterAll(() => destroyDataSources(TEST_DB, dataSource, initDataSource));

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'postgres',
          ...TYPEORM_SHARED_CONFIG,
          autoLoadEntities: true,
          database: TEST_DB,
        }),
        TypeOrmModule.forFeature([Users]),
      ],
      providers: [RanksService],
    }).compile();
    service = module.get<RanksService>(RanksService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it("should return the requester's rank and a total number of players", async () => {
    const { userId } = usersEntities[Math.floor(Math.random() * length)];
    expect(await service.findPosition(userId)).toEqual({
      myRank: rankMap.get(userId),
      total: usersEntities.length,
    });
  });

  it('should return ids, ladders, ranks of a range of users, ordered by their ladders', async () => {
    let ranksDto: RanksDto = await service.findRanks(0, 20);
    expect(ranksDto.users.length).toEqual(20);
    let ladderRank = ranksDto.users.map(({ ladder, rank }) => {
      return { ladder, rank };
    });
    expect(ladderRank).toEqual(
      usersEntities.slice(0, 20).map(({ userId, ladder }) => {
        return { ladder, rank: rankMap.get(userId) };
      }),
    );
    ranksDto = await service.findRanks(30, 42);
    expect(ranksDto.users.length).toEqual(42);
    ladderRank = ranksDto.users.map(({ ladder, rank }) => {
      return { ladder, rank };
    });
    expect(ladderRank).toEqual(
      expect.arrayContaining(
        usersEntities.slice(30, 72).map(({ userId, ladder }) => {
          return { ladder, rank: rankMap.get(userId) };
        }),
      ),
    );
    expect((await service.findRanks(0, 10000)).users.length).toEqual(length);
  });

  it('should throw NOT FOUND when the offset is larger than the total number of users', async () => {
    const offset = length + 1;
    await expect(service.findRanks(offset, 10)).rejects.toThrowError(
      NotFoundException,
    );
  });
});
