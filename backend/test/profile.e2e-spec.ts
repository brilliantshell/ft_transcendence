import { DataSource } from 'typeorm';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { existsSync, unlinkSync } from 'fs';
import { join } from 'path';
import * as request from 'supertest';

import {
  ACHIEVEMENTS_ENTITIES,
  generateAchievers,
  generateMatchHistory,
  generateUsers,
  updateUsersFromMatchHistory,
} from './generate-mock-data';
import { Achievements } from '../src/entity/achievements.entity';
import { Achievers } from '../src/entity/achievers.entity';
import { AppModule } from '../src/app.module';
import { ChannelStorage } from '../src/user-status/channel.storage';
import { MatchHistory } from '../src/entity/match-history.entity';
import {
  TYPEORM_SHARED_CONFIG,
  createDataSources,
  destroyDataSources,
} from './db-resource-manager';
import { UserRelationshipStorage } from '../src/user-status/user-relationship.storage';
import { Users } from '../src/entity/users.entity';

const TEST_DB = 'test_db_profile_e2e';
const ENTITIES = [Achievements, Achievers, MatchHistory, Users];

describe('UserController (e2e)', () => {
  let app: INestApplication;
  let initDataSource: DataSource;
  let dataSource: DataSource;

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
    await app.init();
    await app.listen(4251);
    for (const user of usersEntities) {
      await app.get(UserRelationshipStorage).load(user.userId);
      await app.get(ChannelStorage).loadUser(user.userId);
    }
  });

  afterAll(async () => {
    await app.close();
    await destroyDataSources(TEST_DB, dataSource, initDataSource);
  });

  describe('GET /profile/:userId', () => {
    it('should return a content of my profile', async () => {
      const user = usersEntities[0];
      return request(app.getHttpServer())
        .get(`/profile/${user.userId}`)
        .set('x-user-id', user.userId.toString())
        .expect(200);
    });

    it("should return a content of other's profile", async () => {
      const user = usersEntities[0];
      const otherUser = usersEntities[1];
      return request(app.getHttpServer())
        .get(`/profile/${otherUser.userId}`)
        .set('x-user-id', user.userId.toString())
        .expect(200);
    });

    it('should throw 404 (non-exist user)', async () => {
      const user = usersEntities[0];
      return request(app.getHttpServer())
        .get(`/profile/424242`)
        .set('x-user-id', user.userId.toString())
        .expect(404);
    });

    it('should throw 400 (out of range userId)', async () => {
      const user = usersEntities[0];
      return request(app.getHttpServer())
        .get(`/profile/4210`)
        .set('x-user-id', user.userId.toString())
        .expect(400);
    });

    it('should throw 400 (out of range userId)', async () => {
      const user = usersEntities[0];
      return request(app.getHttpServer())
        .get(`/profile/abcd`)
        .set('x-user-id', user.userId.toString())
        .expect(400);
    });
    // TODO: check invalid userId, non-exist userId
  });

  describe('PATCH /profile/nickname', () => {
    it('should change my nickname', async () => {
      const user = usersEntities[0];
      const newNickname = 'newNick';
      return request(app.getHttpServer())
        .patch(`/profile/nickname`)
        .set('x-user-id', user.userId.toString())
        .send({ nickname: newNickname })
        .expect(200);
    });

    it('should response 409 when duplicated', async () => {
      const user = usersEntities[1];
      const newNickname = usersEntities[2].nickname;
      return request(app.getHttpServer())
        .patch(`/profile/nickname`)
        .set('x-user-id', user.userId.toString())
        .send({ nickname: newNickname })
        .expect(409);
    });

    it('should response 400 when nickname is invalid', async () => {
      const user = usersEntities[1];
      let newNickname = 'abc';
      request(app.getHttpServer())
        .patch(`/profile/nickname`)
        .set('x-user-id', user.userId.toString())
        .send({ nickname: newNickname })
        .expect(400);
      newNickname = 'thisIsTooLongNick'; // 17 characters
      return request(app.getHttpServer())
        .patch(`/profile/nickname`)
        .set('x-user-id', user.userId.toString())
        .send({ nickname: newNickname })
        .expect(400);
    });
  });

  describe('GET /profile/2fa-email', () => {
    it('should return 200 when 2fa email is set', async () => {
      const user = usersEntities[1];
      return request(app.getHttpServer())
        .get(`/profile/2fa-email`)
        .set('x-user-id', user.userId.toString())
        .expect(200);
    });

    it('should return 404 when 2fa email is not set', async () => {
      const user = generateUsers(1)[0];
      delete user.authEmail;
      await dataSource.getRepository(Users).save(user);
      return request(app.getHttpServer())
        .get(`/profile/2fa-email`)
        .set('x-user-id', user.userId.toString())
        .expect(404);
    });
  });

  describe('PATCH /profile/2fa-email', () => {
    it('should return 200 when success to update 2fa email', async () => {
      const user = usersEntities[1];
      const newEmail = 'fooBarBaz@foobar.com';
      request(app.getHttpServer())
        .patch('/profile/2fa-email')
        .set('x-user-id', user.userId.toString())
        .send({ email: newEmail })
        .expect(200);
    });

    it('should return 409 when 2fa email is duplicated', async () => {
      const [userOne, userTwo] = usersEntities;
      return await request(app.getHttpServer())
        .patch(`/profile/2fa-email`)
        .set('x-user-id', userOne.userId.toString())
        .send({ email: userTwo.authEmail })
        .expect(409);
    });

    it('should return 400 when 2fa email is out of form', async () => {
      const user = usersEntities[1];
      // Email format : local-part@domain, local-part <= 64, domain <= 255
      const tooLongDomainPart = 'foo@' + 'a'.repeat(256) + '.com';
      const tooLongLocalPart = 'a'.repeat(65) + '@foobar.com';
      const invalidEmails = [
        'fooBarBazFoobar.com',
        'fooBarBaz@foobar',
        '',
        'a@b.c',
        tooLongDomainPart,
        tooLongLocalPart,
      ];
      for (const invalidEmail of invalidEmails) {
        await request(app.getHttpServer())
          .patch('/profile/2fa-email')
          .set('x-user-id', user.userId.toString())
          .send({ email: invalidEmail })
          .expect(400);
      }
    });
  });

  describe('DELETE /profile/2fa-email', () => {
    it('should return 200 when success to delete 2fa email', async () => {
      const user = usersEntities[1];
      await request(app.getHttpServer())
        .delete(`/profile/2fa-email`)
        .set('x-user-id', user.userId.toString())
        .expect(200);
      await request(app.getHttpServer())
        .patch(`/profile/2fa-email`)
        .set('x-user-id', user.userId.toString())
        .send({ email: user.authEmail })
        .expect(200);
      return request(app.getHttpServer())
        .get(`/profile/2fa-email`)
        .set('x-user-id', user.userId.toString())
        .expect(200)
        .expect(async (res) => {
          expect(res.body.email).toBe(user.authEmail);
        });
    });
  });

  describe('PUT /profile/image', () => {
    const ASSET_DIR = join(__dirname, 'test-asset');
    const PROFILE_DIR = join(__dirname, '..', '/asset/profile-image/');
    it('should return 200 when success to update profile image (png)', async () => {
      const user = usersEntities[8];
      const userId = user.userId.toString();
      await request(app.getHttpServer())
        .put('/profile/image')
        .set('x-user-id', userId)
        .attach('profileImage', `${ASSET_DIR}/tiny.png`)
        .expect(200)
        .expect(() => {
          const file = join(PROFILE_DIR, userId);
          expect(existsSync(file)).toBeTruthy();
          unlinkSync(file);
        });
    });

    it('should return 200 when success to update profile image (jpg)', async () => {
      const user = usersEntities[1];
      const userId = user.userId.toString();
      await request(app.getHttpServer())
        .put('/profile/image')
        .set('x-user-id', userId)
        .attach('profileImage', `${ASSET_DIR}/tiny.jpg`)
        .expect(200)
        .expect(() => {
          const file = join(PROFILE_DIR, userId);
          expect(existsSync(file)).toBeTruthy();
          unlinkSync(file);
        });
    });

    it('should return 200 when success to update profile image (svg)', async () => {
      const user = usersEntities[2];
      const userId = user.userId.toString();

      return await request(app.getHttpServer())
        .put('/profile/image')
        .set('x-user-id', userId)
        .attach('profileImage', `${ASSET_DIR}/tiny.svg`)
        .expect(200)
        .expect(() => {
          const file = join(PROFILE_DIR, userId);
          expect(existsSync(file)).toBeTruthy();
          unlinkSync(file);
        });
    });
    it.skip('should return 200 when almost 4MB image', async () => {
      const user = usersEntities[4];
      const userId = user.userId.toString();
      return request(app.getHttpServer())
        .put('/profile/image')
        .set('x-user-id', userId)
        .attach('profileImage', '/Users/jun/goinfre/almost-4mb.jpg')
        .expect(200)
        .expect(() => {
          const file = join(PROFILE_DIR, userId);
          expect(existsSync(file)).toBeTruthy();
          unlinkSync(file);
        });
    });

    it.skip('should throw 413 Payload Too Large (> 4MB)', async () => {
      const user = usersEntities[5];
      const userId = user.userId.toString();
      return request(app.getHttpServer())
        .put('/profile/image')
        .set('x-user-id', userId)
        .attach('profileImage', '/Users/jun/goinfre/over-4mb.jpg')
        .expect(413);
    });

    it('should throw 415 unsupported media type (bmp)', async () => {
      const user = usersEntities[3];
      const userId = user.userId.toString();
      await request(app.getHttpServer())
        .delete('/profile/image')
        .set('x-user-id', userId)
        .expect(200);

      return request(app.getHttpServer())
        .put('/profile/image')
        .set('x-user-id', userId)
        .attach('profileImage', `${ASSET_DIR}/tiny.bmp`)
        .expect(415);
    });
  });

  describe('DELETE /profile/image', () => {
    const ASSET_DIR = join(__dirname, 'test-asset');
    const PROFILE_DIR = join(__dirname, '..', '/asset/profile-image/');
    it('should delete profile image', async () => {
      const user = usersEntities[4];
      const userId = user.userId.toString();

      await request(app.getHttpServer())
        .put('/profile/image')
        .set('x-user-id', userId)
        .attach('profileImage', `${ASSET_DIR}/tiny.png`)
        .expect(200);

      await request(app.getHttpServer())
        .delete('/profile/image')
        .set('x-user-id', userId)
        .expect(200)
        .expect(() => {
          expect(existsSync(join(PROFILE_DIR, userId))).toBeFalsy();
        });

      expect(
        (
          await dataSource
            .getRepository(Users)
            .findOneBy({ userId: user.userId })
        ).profileImage,
      ).toBeFalsy();

      // delete again
      await request(app.getHttpServer())
        .delete('/profile/image')
        .set('x-user-id', userId)
        .expect(200);
    });
  });
});
