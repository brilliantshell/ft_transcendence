import { DataSource } from 'typeorm';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { join } from 'path';
import * as cookieParser from 'cookie-parser';
import * as request from 'supertest';

import { AppModule } from '../src/app.module';
import { AuthService } from '../src/auth/auth.service';
import {
  TYPEORM_SHARED_CONFIG,
  createDataSources,
  destroyDataSources,
} from './util/db-resource-manager';
import { Users } from '../src/entity/users.entity';
import { existsSync, unlinkSync } from 'fs';
import { generateUsers } from './util/generate-mock-data';

const TEST_DB = 'test_db_login_e2e';
const ENTITIES = [Users];

process.env.DB_HOST = 'localhost';

describe('Login (e2e)', () => {
  let app: INestApplication;
  let initDataSource: DataSource;
  let dataSource: DataSource;
  let authService: AuthService;

  let usersEntities: Users[];

  beforeAll(async () => {
    const dataSources = await createDataSources(TEST_DB, ENTITIES);
    initDataSource = dataSources.initDataSource;
    dataSource = dataSources.dataSource;
    usersEntities = generateUsers(3);
    await dataSource.getRepository(Users).insert(usersEntities);
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
    app.useGlobalPipes(
      new ValidationPipe({
        forbidNonWhitelisted: true,
        transform: true,
        whitelist: true,
      }),
    );
    app.use(cookieParser());
    await app.init();
    await app.listen(4253);
    authService = app.get(AuthService);
  });

  afterAll(async () => {
    await app.close();
    await destroyDataSources(TEST_DB, dataSource, initDataSource);
  });

  it('should not create user info when invalid token', async () => {
    const userId = usersEntities[0].userId;
    // with no token
    await request(app.getHttpServer()).post('/login/user-info').expect(401);
    const { accessToken, refreshToken } = await authService.issueTokens(userId);
    // with access / refresh token
    await request(app.getHttpServer())
      .post('/login/user-info')
      .set('Cookie', [
        `accessToken=${accessToken}`,
        `refreshToken=${refreshToken}`,
      ])
      .expect(401);
  });

  it('should set user info when valid login token and issue access/refresh token', async () => {
    const [user] = generateUsers(1);
    const { userId } = user;
    const restrictedAccessToken =
      authService.issueRestrictedAccessToken(userId);
    const ASSET_DIR = join(__dirname, 'test-asset');
    const PROFILE_DIR = join(__dirname, '..', '/asset/profile-image/');
    // with access / refresh token
    await request(app.getHttpServer())
      .post('/login/user-info')
      .set('Cookie', `restrictedAccessToken=${restrictedAccessToken}`)
      .field('nickname', user.nickname)
      .attach('profileImage', `${ASSET_DIR}/tiny.png`)
      .expect(201)
      .expect(async (res) => {
        const { accessToken, refreshToken } = getToken(res);
        expect(res.headers['set-cookie'][2]).toContain(
          'restrictedAccessToken=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT',
        );
        expect(accessToken).toBeDefined();
        expect(refreshToken).toBeDefined();
        const file = join(PROFILE_DIR, userId.toString());
        expect(existsSync(file)).toBeTruthy();
        const { nickname, isDefaultImage } = await dataSource
          .getRepository(Users)
          .findOneBy({ userId });
        expect(nickname).toBe(user.nickname);
        expect(isDefaultImage).toBeFalsy();
        unlinkSync(file);
      });
  });

  it('should delete access/refresh token when logout', async () => {
    const userId = usersEntities[0].userId;
    const { accessToken, refreshToken } = await authService.issueTokens(userId);
    await request(app.getHttpServer())
      .delete('/logout')
      .set('Cookie', [
        `accessToken=${accessToken}`,
        `refreshToken=${refreshToken}`,
      ])
      .expect(204)
      .expect((res) => {
        expect(res.headers['set-cookie'][0]).toContain(
          'accessToken=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT',
        );
        expect(res.headers['set-cookie'][1]).toContain(
          'refreshToken=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT',
        );
      });
  });
});

const getToken = (res) => {
  const accessToken = res.headers['set-cookie'][0].split(';')[0].split('=')[1];
  const refreshToken = res.headers['set-cookie'][1].split(';')[0].split('=')[1];
  return { accessToken, refreshToken };
};
