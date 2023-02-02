import { DataSource } from 'typeorm';
import { INestApplication } from '@nestjs/common';
import { Socket, io } from 'socket.io-client';
import { Test, TestingModule } from '@nestjs/testing';
import async from 'async';
import { faker } from '@faker-js/faker';
import { getDataSourceToken } from '@nestjs/typeorm';
import * as request from 'supertest';

import { AppModule } from '../src/app.module';
import { BannedMembers } from '../src/entity/banned-members.entity';
import { BlockedUsers } from '../src/entity/blocked-users.entity';
import { ChannelMembers } from '../src/entity/channel-members.entity';
import { Channels } from '../src/entity/channels.entity';
import { Friends } from '../src/entity/friends.entity';
import { Messages } from '../src/entity/messages.entity';
import { UserId } from '../src/util/type';
import { Users } from '../src/entity/users.entity';
import { createDataSources, destroyDataSources } from './db-resource-manager';
import { generateUsers } from './generate-mock-data';

const TEST_DB = 'test_db_user_e2e';
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
  let clientSockets: Socket[];
  let initDataSource: DataSource;
  let dataSource: DataSource;
  let usersEntities: Users[];
  let allUserIds: UserId[];
  let userIds: UserId[];
  let index = 0;

  beforeAll(async () => {
    const dataSources = await createDataSources(TEST_DB, ENTITIES);
    initDataSource = dataSources.initDataSource;
    dataSource = dataSources.dataSource;
    usersEntities = generateUsers(100);
    allUserIds = usersEntities.map(({ userId }) => userId);
    await dataSource.manager.save(Users, usersEntities);
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
      providers: [
        {
          provide: getDataSourceToken(),
          useValue: dataSource,
        },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
    await app.listen(4241);
  });

  beforeEach(async () => {
    userIds = [allUserIds[index++], allUserIds[index++]];
    clientSockets = [
      io('http://localhost:4241', {
        extraHeaders: { 'x-user-id': userIds[0].toString() },
      }),
      io('http://localhost:4241', {
        extraHeaders: { 'x-user-id': userIds[1].toString() },
      }),
    ];
    await Promise.all(
      clientSockets.map(
        (socket) =>
          new Promise((resolve) => socket.on('connect', () => resolve('done'))),
      ),
    );
    clientSockets.forEach((clientSocket, index) =>
      clientSocket.emit('currentUi', { userId: userIds[index], ui: 'profile' }),
    );
    await new Promise((resolve) => setTimeout(() => resolve('done'), 1000));
  });

  afterEach(async () => clientSockets.forEach((socket) => socket.disconnect()));

  afterAll(async () => {
    await app.close();
    await destroyDataSources(TEST_DB, dataSource, initDataSource);
  });

  /*****************************************************************************
   *                                                                           *
   * SECTION : REST API                                                        *
   *                                                                           *
   ****************************************************************************/

  describe('UserGuard', () => {
    it('should throw NOT FOUND when the requested user does not exist', (done) => {
      let targetId = userIds[0];
      while (allUserIds.includes(targetId)) {
        targetId = faker.datatype.number({ min: 10000, max: 999999 });
      }
      const requestObj = request(app.getHttpServer());
      async.series(
        [
          { path: `/user/${targetId}/info`, method: requestObj.get },
          { path: `/user/${targetId}/block`, method: requestObj.put },
          { path: `/user/${targetId}/block`, method: requestObj.delete },
          { path: `/user/${targetId}/friend`, method: requestObj.put },
          { path: `/user/${targetId}/friend`, method: requestObj.delete },
          { path: `/user/${targetId}/friend`, method: requestObj.patch },
          { path: `/user/${targetId}/game`, method: requestObj.patch },
          { path: `/user/${targetId}/game/:gameId`, method: requestObj.get },
        ].map(
          ({ path, method }) =>
            (cb: request.CallbackHandler) =>
              method(path)
                .set('x-user-id', userIds[0].toString())
                .expect(404, cb),
        ),
        done,
      );
    });
  });

  // describe('/user/friends (GET)', () => {
  //   it('no friends', () => {
  //     return request(app.getHttpServer())
  //       .get(`/user/${userIds[0]}`)
  //       .set('x-user-id', userIds[0].toString())
  //       .expect(200)
  //       .expect({ friends: [] });
  //   });

  //   // it('some friends', async () => {
  //   //   request(app.getHttpServer())
  //   //     .get('/user/friends')
  //   //     .set('x-user-id', userIds[0].toString())
  //   //     .expect(200)
  //   //     .expect({ friends: [] });
  //   // });
  // });
});
