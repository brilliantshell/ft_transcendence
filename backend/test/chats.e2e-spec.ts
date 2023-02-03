import { DataSource } from 'typeorm';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { faker } from '@faker-js/faker';
import * as request from 'supertest';

import { AppModule } from '../src/app.module';
import { BannedMembers } from '../src/entity/banned-members.entity';
import { BlockedUsers } from '../src/entity/blocked-users.entity';
import { ChannelMembers } from '../src/entity/channel-members.entity';
import { ChannelStorage } from '../src/user-status/channel.storage';
import { Channels } from '../src/entity/channels.entity';
import { Friends } from '../src/entity/friends.entity';
import { Messages } from '../src/entity/messages.entity';
import { UserRelationshipStorage } from '../src/user-status/user-relationship.storage';
import { Users } from '../src/entity/users.entity';
import {
  TYPEORM_SHARED_CONFIG,
  createDataSources,
  destroyDataSources,
} from './db-resource-manager';
import {
  generateChannels,
  generateChannelMembers,
  generateMessages,
  generateUsers,
} from './generate-mock-data';

process.env.NODE_ENV = 'development';

const TEST_DB = 'test_db_chats_e2e';
const ENTITIES = [
  BannedMembers,
  BlockedUsers,
  ChannelMembers,
  Channels,
  Friends,
  Messages,
  Users,
];

describe('UserController (e2e)', () => {
  let app: INestApplication;
  let initDataSource: DataSource;
  let dataSource: DataSource;
  let usersEntities: Users[];
  let channelsEntities: Channels[];
  let channelMembersEntities: ChannelMembers[];

  beforeAll(async () => {
    const dataSources = await createDataSources(TEST_DB, ENTITIES);
    initDataSource = dataSources.initDataSource;
    dataSource = dataSources.dataSource;
    usersEntities = generateUsers(20);
    channelsEntities = generateChannels(usersEntities);
    await dataSource.getRepository(Users).save(usersEntities);
    await dataSource.getRepository(Channels).save(channelsEntities);
    channelsEntities = await dataSource.getRepository(Channels).find();
    channelMembersEntities = generateChannelMembers(
      usersEntities,
      channelsEntities,
    );
    await dataSource.getRepository(ChannelMembers).save(channelMembersEntities);

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
    await app.listen(4250);
    for (const user of usersEntities) {
      await app.get(UserRelationshipStorage).load(user.userId);
      await app.get(ChannelStorage).loadUser(user.userId);
    }
  });

  afterAll(async () => {
    await app.close();
    await destroyDataSources(TEST_DB, dataSource, initDataSource);
  });

  /*****************************************************************************
   *                                                                           *
   * SECTION : REST API                                                        *
   *                                                                           *
   ****************************************************************************/
  describe('/chats', () => {
    it('GET /chats with valid userId', async () => {
      return request(app.getHttpServer())
        .get('/chats')
        .set('x-user-id', usersEntities[0].userId.toString())
        .expect(200)
        .expect((res) => {
          expect(res.body).toEqual({
            joinedChannels: expect.any(Array),
            otherChannels: expect.any(Array),
          });
        });
    });

    it('GET /chats with invalid userId', async () => {
      return request(app.getHttpServer())
        .get('/chats')
        .set('x-user-id', '4242')
        .expect(400);
    });

    it('POST /chats (valid DTO without password)', async () => {
      return request(app.getHttpServer())
        .post('/chats')
        .set('x-user-id', usersEntities[0].userId.toString())
        .send({ channelName: 'new channel', accessMode: 'public' })
        .expect(201)
        .expect((res) => {
          expect(res.headers['location']).toMatch(/\/chats\/\d+/);
        });
    });

    it('POST /chats (valid DTO with password)', async () => {
      return request(app.getHttpServer())
        .post('/chats')
        .set('x-user-id', usersEntities[0].userId.toString())
        .send({
          channelName: 'new channel',
          password: '1q2w3e4r',
          accessMode: 'protected',
        })
        .expect(201)
        .expect((res) => {
          expect(res.headers['location']).toMatch(/\/chats\/\d+/);
        });
    });

    it('POST /chats (invalid DTO with empty channelName)', async () => {
      return request(app.getHttpServer())
        .post('/chats')
        .set('x-user-id', usersEntities[0].userId.toString())
        .send({ channelName: '', accessMode: 'public' })
        .expect(400);
    });

    it('POST /chats (invalid DTO with unexpected accessMode)', async () => {
      return request(app.getHttpServer())
        .post('/chats')
        .set('x-user-id', usersEntities[0].userId.toString())
        .send({ channelName: '400', accessMode: 'PUblic' })
        .expect(400);
    });

    it('POST /chats (invalid DTO with unexpected password)', async () => {
      return request(app.getHttpServer())
        .post('/chats')
        .set('x-user-id', usersEntities[0].userId.toString())
        .send({
          channelName: '400',
          password: 'doNotNeeded',
          accessMode: 'public',
        })
        .expect(400);
    });

    it('POST /chats (invalid DTO with too long password)', async () => {
      return request(app.getHttpServer())
        .post('/chats')
        .set('x-user-id', usersEntities[0].userId.toString())
        .send({
          channelName: '400',
          password: 'ThisIsReallyLongPWD21', // 21 characters
          accessMode: 'protected',
        })
        .expect(400);
    });

    it('POST /chats (invalid DTO with Unicode password)', async () => {
      return request(app.getHttpServer())
        .post('/chats')
        .set('x-user-id', usersEntities[0].userId.toString())
        .send({
          channelName: '400',
          password: '왜이러는걸까요',
          accessMode: 'protected',
        })
        .expect(400);
    });
  });

  describe('/chats/:channelId, Join & Leave channel', () => {
    it('GET /chats/:channelId with existing channelId (not DM)', async () => {
      const channel = channelsEntities.find((c) => c.dmPeerId === null);
      return request(app.getHttpServer())
        .get(`/chats/${channel.channelId}`)
        .set('x-user-id', channel.ownerId.toString())
        .expect(200)
        .expect((res) => {
          expect(res.body).toMatchObject({
            channelMembers: expect.any(Array),
            isReadonlyDm: null,
          });
        });
    });

    it('GET /chats/:channelId with existing channelId (DM)', async () => {
      const channel = channelsEntities.find((c) => c.dmPeerId !== null);
      return request(app.getHttpServer())
        .get(`/chats/${channel.channelId}`)
        .set('x-user-id', channel.ownerId.toString())
        .expect(200)
        .expect((res) => {
          expect(res.body).toMatchObject({
            channelMembers: expect.any(Array),
            isReadonlyDm: expect.any(Boolean),
          });
        });
    });

    it('GET /chats/:channelId with non-member userId', async () => {
      const channel = channelsEntities.find((c) => c.dmPeerId === null);
      const channelMemberIds = channelMembersEntities
        .filter((c) => {
          return c.channelId === channel.channelId;
        })
        .map((v) => v.memberId);
      const nonChannelMember = usersEntities.find(
        (u) => !channelMemberIds.includes(u.userId),
      );
      if (nonChannelMember === undefined) {
        return console.log(
          'GET /chats/:channelId with non-member userId TEST SKIPPED!!!',
        );
      }
      const nonChannelMemberId = nonChannelMember.userId;
      return request(app.getHttpServer())
        .get(`/chats/${channel.channelId}`)
        .set('x-user-id', nonChannelMemberId.toString())
        .expect(403);
    });

    it('GET /chats/:channelId with non-existing channelId', async () => {
      return request(app.getHttpServer())
        .get(`/chats/42424242`)
        .set('x-user-id', usersEntities[0].userId.toString())
        .expect(404);
    });

    it('POST /chats/:channelId/user/:userId (invited, public)', async () => {
      let newChannelId: string;
      const newChannelOwner = usersEntities[2];
      await request(app.getHttpServer())
        .post('/chats')
        .set('x-user-id', newChannelOwner.userId.toString())
        .send({
          channelName: 'test',
          accessMode: 'public',
        })
        .expect(201)
        .expect(async (res) => {
          newChannelId = res.headers['location'].replace('/chats/', '');
        });

      const newChannelMember = usersEntities[3];

      return request(app.getHttpServer())
        .post(`/chats/${newChannelId}/user/${newChannelMember.userId}`)
        .set('x-user-id', newChannelOwner.userId.toString())
        .expect(201);
    });

    it('POST /chats/:channelId/user/:userId (not invited, protected)', async () => {
      let newChannelId: string;
      const newChannelOwner = usersEntities[2];
      await request(app.getHttpServer())
        .post('/chats')
        .set('x-user-id', newChannelOwner.userId.toString())
        .send({
          channelName: 'test',
          accessMode: 'protected',
          password: 'abc1234!',
        })
        .expect(201)
        .expect(async (res) => {
          newChannelId = res.headers['location'].replace('/chats/', '');
        });

      const newChannelMember = usersEntities[3];

      return request(app.getHttpServer())
        .post(`/chats/${newChannelId}/user/${newChannelMember.userId}`)
        .set('x-user-id', newChannelMember.userId.toString())
        .send({ password: 'abc1234!' })
        .expect(201);
    });

    it('POST /chats/:channelId/user/:userId (not invited, incorrect password)', async () => {
      let newChannelId: string;
      const newChannelOwner = usersEntities[2];
      await request(app.getHttpServer())
        .post('/chats')
        .set('x-user-id', newChannelOwner.userId.toString())
        .send({
          channelName: 'test',
          accessMode: 'protected',
          password: 'abc1234!',
        })
        .expect(201)
        .expect(async (res) => {
          newChannelId = res.headers['location'].replace('/chats/', '');
        });

      const newChannelMember = usersEntities[3];

      return request(app.getHttpServer())
        .post(`/chats/${newChannelId}/user/${newChannelMember.userId}`)
        .set('x-user-id', newChannelMember.userId.toString())
        .send({ password: 'Abc1234!' })
        .expect(403);
    });

    it('POST /chats/:channelId/user/:userId (invited, protected)', async () => {
      let newChannelId: string;
      const newChannelOwner = usersEntities[2];
      await request(app.getHttpServer())
        .post('/chats')
        .set('x-user-id', newChannelOwner.userId.toString())
        .send({
          channelName: 'test',
          accessMode: 'protected',
          password: 'abc1234!',
        })
        .expect(201)
        .expect(async (res) => {
          newChannelId = res.headers['location'].replace('/chats/', '');
        });

      const newChannelMember = usersEntities[3];

      return request(app.getHttpServer())
        .post(`/chats/${newChannelId}/user/${newChannelMember.userId}`)
        .set('x-user-id', newChannelOwner.userId.toString())
        .expect(201);
    });

    it('POST /chats/:channelId/user/:userId (invited, private)', async () => {
      let newChannelId: string;
      const newChannelOwner = usersEntities[2];
      await request(app.getHttpServer())
        .post('/chats')
        .set('x-user-id', newChannelOwner.userId.toString())
        .send({
          channelName: 'test',
          accessMode: 'private',
        })
        .expect(201)
        .expect(async (res) => {
          newChannelId = res.headers['location'].replace('/chats/', '');
        });

      const newChannelMember = usersEntities[3];

      return request(app.getHttpServer())
        .post(`/chats/${newChannelId}/user/${newChannelMember.userId}`)
        .set('x-user-id', newChannelOwner.userId.toString())
        .expect(201);
    });

    it('POST /chats/:channelId/user/:userId (not invited, private)', async () => {
      let newChannelId: string;
      const newChannelOwner = usersEntities[2];
      await request(app.getHttpServer())
        .post('/chats')
        .set('x-user-id', newChannelOwner.userId.toString())
        .send({
          channelName: 'test',
          accessMode: 'private',
        })
        .expect(201)
        .expect(async (res) => {
          newChannelId = res.headers['location'].replace('/chats/', '');
        });

      const newChannelMember = usersEntities[3];

      return request(app.getHttpServer())
        .post(`/chats/${newChannelId}/user/${newChannelMember.userId}`)
        .set('x-user-id', newChannelMember.userId.toString())
        .expect(403);
    });

    it('DELETE /chats/:channelId/user (owner)', async () => {
      let newChannelId: string;
      const newChannelOwner = usersEntities[2];
      await request(app.getHttpServer())
        .post('/chats')
        .set('x-user-id', newChannelOwner.userId.toString())
        .send({
          channelName: 'test',
          accessMode: 'public',
        })
        .expect(201)
        .expect(async (res) => {
          newChannelId = res.headers['location'].replace('/chats/', '');
        });
      return request(app.getHttpServer())
        .delete(`/chats/${newChannelId}/user`)
        .set('x-user-id', newChannelOwner.userId.toString())
        .expect(200);
    });

    it('DELETE /chats/:channelId/user (not owner)', async () => {
      let newChannelId: string;
      const newChannelOwner = usersEntities[2];
      await request(app.getHttpServer())
        .post('/chats')
        .set('x-user-id', newChannelOwner.userId.toString())
        .send({
          channelName: 'test',
          accessMode: 'public',
        })
        .expect(201)
        .expect(async (res) => {
          newChannelId = res.headers['location'].replace('/chats/', '');
        });

      const newChannelMember = usersEntities[3];
      await request(app.getHttpServer())
        .post(`/chats/${newChannelId}/user/${newChannelMember.userId}`)
        .set('x-user-id', newChannelMember.userId.toString())
        .expect(201);
      return request(app.getHttpServer())
        .delete(`/chats/${newChannelId}/user`)
        .set('x-user-id', newChannelMember.userId.toString())
        .expect(200);
    });

    it('DELETE /chats/:channelId/user (not channel member)', async () => {
      let newChannelId: string;
      const newChannelOwner = usersEntities[2];
      await request(app.getHttpServer())
        .post('/chats')
        .set('x-user-id', newChannelOwner.userId.toString())
        .send({
          channelName: 'test',
          accessMode: 'public',
        })
        .expect(201)
        .expect(async (res) => {
          newChannelId = res.headers['location'].replace('/chats/', '');
        });

      const newChannelMember = usersEntities[3];
      return request(app.getHttpServer())
        .delete(`/chats/${newChannelId}/user`)
        .set('x-user-id', newChannelMember.userId.toString())
        .expect(403);
    });
  });

  describe('/chats/:channelId, Messages', () => {
    it('GET /chats/:channelId/message?range=2,10 ', async () => {
      const channel = channelsEntities.find((c) => c.dmPeerId !== null);
      const messages = generateMessages(
        channelMembersEntities.filter((c) => c.channelId === channel.channelId),
      );
      const [offset, size] = [2, 10];
      await dataSource.getRepository(Messages).insert(messages);
      return request(app.getHttpServer())
        .get(`/chats/${channel.channelId}/message`)
        .query({ range: `${offset},${size}` })
        .set('x-user-id', channel.ownerId.toString())
        .expect(200)
        .expect(async (res) => {
          const resLength = res.body.messages.length;
          resLength < size
            ? expect(resLength).toBe(messages.length - offset)
            : expect(resLength).toBe(size);
          expect(res.body.messages.length).toBeLessThanOrEqual(42);
          await dataSource.getRepository(Messages).remove(messages);
        });
    });

    it('GET /chats/:channelId/message?range=-4,2 (invalid) ', async () => {
      const channel = channelsEntities.find((c) => c.dmPeerId !== null);
      const messages = generateMessages(
        channelMembersEntities.filter((c) => c.channelId === channel.channelId),
      );
      const [offset, size] = [-4, 2];
      await dataSource.getRepository(Messages).insert(messages);
      return request(app.getHttpServer())
        .get(`/chats/${channel.channelId}/message`)
        .query({ range: `${offset},${size}` })
        .set('x-user-id', channel.ownerId.toString())
        .expect(400);
    });

    it('GET /chats/:channelId/message?range=0,MAX_MESSAGE + 1 (invalid) ', async () => {
      const channel = channelsEntities.find((c) => c.dmPeerId !== null);
      const messages = generateMessages(
        channelMembersEntities.filter((c) => c.channelId === channel.channelId),
      );
      const MAX_MESSAGE = 10000;
      const [offset, size] = [0, MAX_MESSAGE + 1];
      await dataSource.getRepository(Messages).insert(messages);
      return request(app.getHttpServer())
        .get(`/chats/${channel.channelId}/message`)
        .query({ range: `${offset},${size}` })
        .set('x-user-id', channel.ownerId.toString())
        .expect(400);
    });

    it('POST /chats/:channelId/message (valid DTO)', async () => {
      const channel = channelsEntities.find((c) => c.dmPeerId !== null);
      return request(app.getHttpServer())
        .post(`/chats/${channel.channelId}/message`)
        .set('x-user-id', channel.ownerId.toString())
        .send({
          message: 'test message',
        })
        .expect(201);
    });

    it('POST /chats/:channelId/message (invalid DTO, empty message)', async () => {
      const channel = channelsEntities.find((c) => c.dmPeerId !== null);
      return request(app.getHttpServer())
        .post(`/chats/${channel.channelId}/message`)
        .set('x-user-id', channel.ownerId.toString())
        .send({
          message: '',
        })
        .expect(400);
    });

    it('POST /chats/:channelId/message (invalid DTO, message too large)', async () => {
      const channel = channelsEntities.find((c) => c.dmPeerId !== null);
      return request(app.getHttpServer())
        .post(`/chats/${channel.channelId}/message`)
        .set('x-user-id', channel.ownerId.toString())
        .send({
          message: faker.datatype.string(4097),
        })
        .expect(400);
    });
  });
});
