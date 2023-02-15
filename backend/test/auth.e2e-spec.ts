import { DataSource } from 'typeorm';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import * as cookieParser from 'cookie-parser';
import * as request from 'supertest';

import { Achievements } from '../src/entity/achievements.entity';
import { Achievers } from '../src/entity/achievers.entity';
import { AppModule } from '../src/app.module';
import { AuthService } from '../src/auth/auth.service';
import { MatchHistory } from '../src/entity/match-history.entity';
import {
  TYPEORM_SHARED_CONFIG,
  createDataSources,
  destroyDataSources,
} from './util/db-resource-manager';
import { Users } from '../src/entity/users.entity';
import { generateUsers } from './util/generate-mock-data';

const TEST_DB = 'test_db_auth_e2e';
const ENTITIES = [Achievements, Achievers, MatchHistory, Users];

process.env.DB_HOST = 'localhost';

describe('AuthGuard (e2e)', () => {
  let app: INestApplication;
  let initDataSource: DataSource;
  let dataSource: DataSource;
  let authService: AuthService;

  let usersEntities: Users[];

  beforeAll(async () => {
    const dataSources = await createDataSources(TEST_DB, ENTITIES);
    initDataSource = dataSources.initDataSource;
    dataSource = dataSources.dataSource;
    usersEntities = generateUsers(10);
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
    await app.listen(4252);
    authService = app.get(AuthService);
  });

  afterAll(async () => {
    await app.close();
    await destroyDataSources(TEST_DB, dataSource, initDataSource);
  });

  /**
   * Synopsis No.1, Normal Case (Refresh Token Rotation)
   * 1. 유저가 정상적으로 로그인 하여 access, refresh token 발급 받는다.
   * 2. 유저의 access token 이 만료되고, 다시 요청을 보내면 refresh token 으로 재발급 받는다.
   * 3. 유저의 refresh token 도 재발급 되어야 한다.
   * 4. 서버엔 이전 refresh token (invalid)/ 새로 발급된 refresh token (valid) 이 저장되어 있어야 한다.
   * 5. 재발급된 토큰으로 다시 로그인 할 수 있게 되며 1번으로 돌아간다.
   */
  it('Synopsis No.1, Normal Case', async () => {
    const userId = usersEntities[0].userId;
    // 1번
    const { accessToken, refreshToken } = await authService.issueTokens(userId);
    // 2번
    await request(app.getHttpServer())
      .get(`/profile/${userId}`)
      .set('Cookie', [
        `accessToken=${accessToken}`,
        `refreshToken=${refreshToken}`,
      ])
      .expect(200);
    await new Promise((resolve) => setTimeout(resolve, 1000));
    // 3번
    let newTokens;
    await request(app.getHttpServer())
      .get(`/profile/${userId}`)
      .set('Cookie', [`accessToken=${null}`, `refreshToken=${refreshToken}`])
      .expect(200)
      .expect(async (res) => {
        newTokens = getToken(res);
        expect(newTokens.accessToken).not.toBe(accessToken);
        expect(newTokens.refreshToken).not.toBe(refreshToken);
        const refreshTokens = await (authService as any).findRefreshTokens(
          userId,
        );
        // 4번
        expect(refreshTokens[0]).toEqual({
          token: refreshToken,
          isRevoked: true,
        });
        expect(refreshTokens[1]).toEqual({
          token: newTokens.refreshToken,
          isRevoked: false,
        });
      });
    // 5번
    await request(app.getHttpServer())
      .get(`/profile/${userId}`)
      .set('Cookie', [
        `accessToken=${newTokens.accessToken}`,
        `refreshToken=${newTokens.refreshToken}`,
      ])
      .expect(200);
  });

  /**
   * Synopsis No.2 Expired Refresh Token
   * 1. 유저가 정상적으로 로그인 하여 access, refresh token 발급 받는다.
   * 2. 유저의 refresh token 이 만료되고, 다시 요청을 보내면 401 에러가 발생한다.
   * 3. 유저는 재로그인 하여 토큰을 발급받고, 로그인이 가능해진다.
   */
  it('Synopsis No.2 Expired Refresh Token', async () => {
    const userId = usersEntities[0].userId;
    // 1번
    const { accessToken, refreshToken } = await authService.issueTokens(userId);
    await request(app.getHttpServer())
      .get(`/profile/${userId}`)
      .set('Cookie', [
        `accessToken=${accessToken}`,
        `refreshToken=${refreshToken}`,
      ])
      .expect(200);

    // 2번
    await request(app.getHttpServer())
      .get(`/profile/${userId}`)
      .set('Cookie', [`accessToken=${null}`, `refreshToken=${null}`])
      .expect(401);

    // 3번
    const newTokens = await authService.issueTokens(userId);
    await request(app.getHttpServer())
      .get(`/profile/${userId}`)
      .set('Cookie', [
        `accessToken=${newTokens.accessToken}`,
        `refreshToken=${newTokens.refreshToken}`,
      ])
      .expect(200);
  });

  /**
   * Synopsis No.3-1, Automatic reuse detection (Malicious Client Take Over)
   * @see [Automatic reuse detection](https://auth0.com/docs/secure/tokens/refresh-tokens/refresh-token-rotation#automatic-reuse-detection)
   * 1. 순진무구한(Legitimate user) 유저가 refreshToken_one 을 갖고 있지만, 이 토큰이 유출되거나 악의적인 유저에게 탈튀당했다.
   * 2. 순진무구한 유저가 refreshToken_one 을 사용하여 새로운 access/refresh token 을 발급을 시도한다.
   * 3. 서버는 새로운 access/refresh token 을 발급한다. (refreshToken_two)
   * 4. 악의적인(Malicious) 유저가 refreshToken_one 을 사용하여 새로운 access/refresh token 을 발급을 시도한다.
   * 5. 서버는 refreshToken_one 을 사용하여 새로운 access/refresh token 을 발급하지 않고, 401 에러를 발생시킨다.
   *   5-1. 또한, 서버는 refreshToken_one 의 잘못된 사용을 탐지하고, refreshToken_one 과 refreshToken_two 를 모두 폐기한다.
   * 6. 순진무구한 유저가 refreshToken_two 를 사용하려고 하면, 401 에러를 발생시켜 다시 로그인 시킨다.
   */
  it('Synopsis No.3-1, RefreshToken stolen, but Legitimate user use first', async () => {
    const userId = usersEntities[2].userId;
    const tokenOne = await authService.issueTokens(userId);
    // 2번
    let tokenTwo;
    await request(app.getHttpServer())
      .get(`/profile/${userId}`)
      .set('Cookie', [
        `accessToken=${null}`,
        `refreshToken=${tokenOne.refreshToken}`,
      ])
      .expect(200)
      .expect(async (res) => {
        // 3번
        tokenTwo = getToken(res);
      });
    await new Promise((resolve) => setTimeout(resolve, 1000));
    // 4번
    await request(app.getHttpServer())
      .get(`/profile/${userId}`)
      .set('Cookie', [
        `accessToken=${null}`,
        `refreshToken=${tokenOne.refreshToken}`,
      ])
      // 5번
      .expect(401)
      .then(async () => {
        // 5-1 번
        const savedRefreshTokens = await (authService as any).findRefreshTokens(
          userId,
        );
        expect(savedRefreshTokens[0].isRevoked).toBeTruthy();
        expect(savedRefreshTokens[1].isRevoked).toBeTruthy();
        // 6번
        await request(app.getHttpServer())
          .get(`/profile/${userId}`)
          .set('Cookie', [
            `accessToken=${null}`,
            `refreshToken=${tokenTwo.refreshToken}`,
          ])
          .expect(401);
      });
  });

  /**
   * Synopsis No.3-2, Automatic reuse detection (Malicious Client Take Over)
   * @see [Automatic reuse detection](https://auth0.com/docs/secure/tokens/refresh-tokens/refresh-token-rotation#automatic-reuse-detection)
   * 1. 순진무구한(Legitimate user) 유저가 refreshToken_one 을 갖고 있지만, 이 토큰이 유출되거나 악의적인 유저에게 탈튀당했다.
   * 2. 악의적인(Malicious) 유저가 refreshToken_one 을 사용하여 새로운 access/refresh token 을 발급을 시도한다.
   * 3. 서버는 새로운 access/refresh token 을 발급한다. (refreshToken_two)
   * 4. 순진무구한 유저가 refreshToken_one 을 사용하여 새로운 access/refresh token 을 발급을 시도한다.
   * 5. 서버는 refreshToken_one 을 사용하여 새로운 access/refresh token 을 발급하지 않고, 401 에러를 발생시킨다.
   *   5-1. 또한, 서버는 refreshToken_one 의 잘못된 사용을 탐지하고, refreshToken_one 과 refreshToken_two 를 모두 폐기한다.
   * 6. 악의적인 유저가 refreshToken_two 를 사용하려고 하면, 401 에러를 발생시켜 다시 로그인 시킨다.
   */
  it('Synopsis No.3-2, RefreshToken stolen, Malicious User use first', async () => {
    const userId = usersEntities[2].userId;
    const tokenOne = await authService.issueTokens(userId);
    // 2번
    let tokenTwo;
    await request(app.getHttpServer())
      .get(`/profile/${userId}`)
      .set('Cookie', [
        `accessToken=${null}`,
        `refreshToken=${tokenOne.refreshToken}`,
      ])
      .expect(200)
      .expect(async (res) => {
        // 3번
        tokenTwo = getToken(res);
      });
    await new Promise((resolve) => setTimeout(resolve, 1000));
    // 4번
    await request(app.getHttpServer())
      .get(`/profile/${userId}`)
      .set('Cookie', [
        `accessToken=${null}`,
        `refreshToken=${tokenOne.refreshToken}`,
      ])
      // 5번
      .expect(401)
      .then(async () => {
        // 5-1 번
        const savedRefreshTokens = await (authService as any).findRefreshTokens(
          userId,
        );
        expect(savedRefreshTokens[0].isRevoked).toBeTruthy();
        expect(savedRefreshTokens[1].isRevoked).toBeTruthy();
        // 6번
        await request(app.getHttpServer())
          .get(`/profile/${userId}`)
          .set('Cookie', [
            `accessToken=${null}`,
            `refreshToken=${tokenTwo.refreshToken}`,
          ])
          .expect(401);
      });
  });
});

const getToken = (res) => {
  const accessToken = res.headers['set-cookie'][0].split(';')[0].split('=')[1];
  const refreshToken = res.headers['set-cookie'][1].split(';')[0].split('=')[1];
  return { accessToken, refreshToken };
};
