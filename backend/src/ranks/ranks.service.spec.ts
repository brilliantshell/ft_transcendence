import { DataSource } from 'typeorm';
import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { faker } from '@faker-js/faker';

import { RanksService } from './ranks.service';
import {
  TYPEORM_SHARED_CONFIG,
  createDataSources,
  destroyDataSources,
} from '../../test/db-resource-manager';
import { Users } from '../entity/users.entity';
import { generateUsers } from '../../test/generate-mock-data';

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
    let currentLadder = Number.MAX_SAFE_INTEGER;
    let position = 1;
    usersEntities.forEach((user: Users) => {
      if (currentLadder > user.ladder) {
        currentLadder = user.ladder;
        rankMap.set(user.ladder, position);
        position++;
      }
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
    const { userId, ladder } =
      usersEntities[Math.floor(Math.random() * length)];
    expect(await service.findPosition(userId)).toEqual({
      myRank: rankMap.get(ladder),
      total: usersEntities.length,
    });
  });

  // it('should return ids and ladders of a range of users, ordered by their ladders', async () => {});
});
