import { DataSource } from 'typeorm';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import * as request from 'supertest';

import { AppModule } from '../src/app.module';
import {
  TYPEORM_SHARED_CONFIG,
  createDataSources,
  destroyDataSources,
} from './db-resource-manager';
import { UserId } from '../src/util/type';
import { Users } from '../src/entity/users.entity';
import { generateUsers } from './generate-mock-data';

const TEST_DB = 'test_db_ranks_e2e';
const ENTITIES = [Users];

process.env.NODE_ENV = 'development';
process.env.DB_HOST = 'localhost';

describe('RanksController (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let initDataSource: DataSource;
  let usersEntities: Users[];
  let userCount: number;
  let user: Users;
  let stringId: string;
  const rankMap: Map<UserId, number> = new Map();

  beforeAll(async () => {
    const dataSources = await createDataSources(TEST_DB, ENTITIES);
    initDataSource = dataSources.initDataSource;
    dataSource = dataSources.dataSource;
    usersEntities = generateUsers(1000).sort((a, b) => b.ladder - a.ladder);
    userCount = usersEntities.length;
    await dataSource.manager.save(usersEntities);
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
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'postgres',
          ...TYPEORM_SHARED_CONFIG,
          autoLoadEntities: true,
          database: TEST_DB,
        }),
        AppModule,
      ],
    }).compile();
    app = moduleFixture.createNestApplication();
    await app.init();
    user = usersEntities[Math.floor(Math.random() * userCount)];
    stringId = user.userId.toString();
  });

  afterAll(async () => {
    await app.close();
    await destroyDataSources(TEST_DB, dataSource, initDataSource);
  });

  describe('GET /ranks/my-rank', () => {
    it('should return my rank and a number of users', async () => {
      const { body } = await request(app.getHttpServer())
        .get('/ranks/my-rank')
        .set('x-user-id', stringId)
        .expect(200);
      expect(body).toEqual({
        myRank: rankMap.get(user.userId),
        total: userCount,
      });
    });
  });

  describe('GET /ranks', () => {
    it('should return a list of id, ladder and rank of users in a given range', async () => {
      const { body } = await request(app.getHttpServer())
        .get('/ranks')
        .set('x-user-id', stringId)
        .query('range=0,20')
        .expect(200);
      expect(body.users).toHaveLength(20);
      body.users.forEach(({ id, ladder, rank }) => {
        expect(ladder).toEqual(
          usersEntities.find(({ userId }) => userId === id).ladder,
        );
        expect(rankMap.get(id)).toEqual(rank);
      });
    });

    it('should accept limit up to 100', async () => {
      const { body } = await request(app.getHttpServer())
        .get('/ranks')
        .set('x-user-id', stringId)
        .query('range=0,100')
        .expect(200);
      expect(body.users).toHaveLength(100);
      body.users.forEach(({ id, ladder, rank }) => {
        expect(ladder).toEqual(
          usersEntities.find(({ userId }) => userId === id).ladder,
        );
        expect(rankMap.get(id)).toEqual(rank);
      });
    });

    it('should return as many as the number of remaining users from the offset when length - offset < limit', async () => {
      const { body } = await request(app.getHttpServer())
        .get('/ranks')
        .set('x-user-id', stringId)
        .query(`range=${userCount - 42},100`)
        .expect(200);
      expect(body.users).toHaveLength(42);
      body.users.forEach(({ id, ladder, rank }) => {
        expect(ladder).toEqual(
          usersEntities.find(({ userId }) => userId === id).ladder,
        );
        expect(rankMap.get(id)).toEqual(rank);
      });
    });

    it('should throw BAD REQUEST if the limit is over 100', () => {
      return request(app.getHttpServer())
        .get('/ranks')
        .set('x-user-id', stringId)
        .query('range=0,101')
        .expect(400);
    });

    it('should throw BAD REQUEST if the range is 0,0', () => {
      return request(app.getHttpServer())
        .get('/ranks')
        .set('x-user-id', stringId)
        .query('range=0,0')
        .expect(400);
    });

    it('should throw BAD REQUEST if the range has negative number', () => {
      return request(app.getHttpServer())
        .get('/ranks')
        .set('x-user-id', stringId)
        .query('range=-1,20')
        .expect(400);
    });

    it('should throw BAD REQUEST if the offset is out of range', () => {
      return request(app.getHttpServer())
        .get('/ranks')
        .set('x-user-id', stringId)
        .query('range=2147483648,20')
        .expect(400);
    });

    it('should throw NOT FOUND if the offset > total number of users', () => {
      return request(app.getHttpServer())
        .get('/ranks')
        .set('x-user-id', stringId)
        .query(`range=${userCount},20`)
        .expect(404);
    });
  });
});
