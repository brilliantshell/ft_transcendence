import { DataSource } from 'typeorm';
import { INestApplication } from '@nestjs/common';
import { Socket, io } from 'socket.io-client';
import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { faker } from '@faker-js/faker';
import * as request from 'supertest';

import { AppModule } from '../src/app.module';
import { BannedMembers } from '../src/entity/banned-members.entity';
import { BlockedUsers } from '../src/entity/blocked-users.entity';
import { ChannelMembers } from '../src/entity/channel-members.entity';
import { Channels } from '../src/entity/channels.entity';
import { Friends } from '../src/entity/friends.entity';
import { Messages } from '../src/entity/messages.entity';
import { UserId } from '../src/util/type';
import { UserRelationshipStorage } from '../src/user-status/user-relationship.storage';
import { Users } from '../src/entity/users.entity';
import {
  TYPEORM_SHARED_CONFIG,
  createDataSources,
  destroyDataSources,
} from './db-resource-manager';
import {
  generateUsers,
  generateBlockedUsers,
  generateFriends,
} from './generate-mock-data';

process.env.NODE_ENV = 'development';

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
    await app.listen(4241);
  });

  beforeEach(async () => {
    userIds = [allUserIds[index], allUserIds[index + 1]];
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
    await new Promise((resolve) => setTimeout(() => resolve('done'), 360));
  });

  afterEach(async () => {
    clientSockets.forEach((socket) => socket.disconnect());
    index += 2;
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

  describe('UserGuard', () => {
    let userRelationshipStorage: UserRelationshipStorage;
    it('should throw NOT FOUND when the requested user does not exist', async () => {
      let targetId = userIds[0];
      while (allUserIds.includes(targetId)) {
        targetId = faker.datatype.number({ min: 10000, max: 999999 });
      }
      const reqObj = request(app.getHttpServer());
      await expect(
        Promise.all(
          [
            { path: `/user/${targetId}/info`, method: reqObj.get },
            { path: `/user/${targetId}/block`, method: reqObj.put },
            { path: `/user/${targetId}/block`, method: reqObj.delete },
            { path: `/user/${targetId}/friend`, method: reqObj.put },
            { path: `/user/${targetId}/friend`, method: reqObj.delete },
            { path: `/user/${targetId}/friend`, method: reqObj.patch },
            { path: `/user/${targetId}/game`, method: reqObj.post },
            { path: `/user/${targetId}/game/:gameId`, method: reqObj.get },
          ].map(({ path, method }) =>
            method(path)
              .set('x-user-id', userIds[0].toString())
              .then((response) => expect(response.status).toEqual(404)),
          ),
        ),
      ).resolves.toBeDefined();
    });

    it('should throw FORBIDDEN when the requester is a blocked user', async () => {
      userRelationshipStorage = app.get(UserRelationshipStorage);
      const [blockerId, blockedId] = userIds;
      const blockedUsersEntities = generateBlockedUsers(
        usersEntities.slice(index, index + 2),
      );
      await dataSource.manager.save(BlockedUsers, blockedUsersEntities);
      await userRelationshipStorage.load(blockedId);
      const reqObj = request(app.getHttpServer());
      await expect(
        Promise.all(
          [
            { path: `/user/${blockerId}/block`, method: reqObj.put },
            { path: `/user/${blockerId}/block`, method: reqObj.delete },
            { path: `/user/${blockerId}/friend`, method: reqObj.put },
            { path: `/user/${blockerId}/friend`, method: reqObj.delete },
            { path: `/user/${blockerId}/friend`, method: reqObj.patch },
            { path: `/user/${blockerId}/game`, method: reqObj.post },
            { path: `/user/${blockerId}/game/:gameId`, method: reqObj.get },
          ].map(({ path, method }) =>
            method(path)
              .set('x-user-id', blockedId.toString())
              .then((res) => expect(res.status).toEqual(403)),
          ),
        ),
      ).resolves.toBeDefined();
    });

    it("should NOT throw FORBIDDEN even if the requester is blocked when the request path is '/user/:userId/info'", async () => {
      const [blockerId, blockedId] = userIds;
      const blockedUsersEntities = generateBlockedUsers(
        usersEntities.slice(index, index + 2),
      );
      await dataSource.manager.save(BlockedUsers, blockedUsersEntities);
      await userRelationshipStorage.load(blockedId);
      return request(app.getHttpServer())
        .get(`/user/${blockerId}/info`)
        .set('x-user-id', blockedId.toString())
        .expect(200);
    });

    it('should throw NOT FOUND when the requester tries to unblock another user with whom he has no relationship', () => {
      return request(app.getHttpServer())
        .delete(`/user/${userIds[1]}/block`)
        .set('x-user-id', userIds[0].toString())
        .expect(404);
    });

    it('should throw NOT FOUND when the requester tries to unblock pendingSender/pendingReceiver/friend', async () => {
      const friendsEntities = generateFriends(
        usersEntities.slice(index, index + 2),
      );
      await dataSource.manager.save(Friends, friendsEntities);
      await userRelationshipStorage.load(userIds[0]);
      return request(app.getHttpServer())
        .delete(`/user/${userIds[1]}/block`)
        .set('x-user-id', userIds[0].toString())
        .expect(404);
    });

    it('should throw NOT FOUND when the requester tries to delete friendship with a user with whom he has no relationship', () => {
      return request(app.getHttpServer())
        .delete(`/user/${userIds[1]}/friend`)
        .set('x-user-id', userIds[0].toString())
        .expect(404);
    });

    it('should throw NOT FOUND when a blocker tries to delete friendship with the blocked', async () => {
      const [blockerId, blockedId] = userIds;
      const blockedUsersEntities = generateBlockedUsers(
        usersEntities.slice(index, index + 2),
      );
      await dataSource.manager.save(BlockedUsers, blockedUsersEntities);
      await userRelationshipStorage.load(blockedId);
      return request(app.getHttpServer())
        .delete(`/user/${blockedId}/friend`)
        .set('x-user-id', blockerId.toString())
        .expect(404);
    });

    it('should throw BAD REQUEST when a friend or a pendingReceiver tries to send a friend request', async () => {
      const [senderId, receiverId] = userIds;
      const friendsEntities = generateFriends(
        usersEntities.slice(index, index + 2),
      );
      await dataSource.manager.save(Friends, friendsEntities);
      await userRelationshipStorage.load(receiverId);
      return request(app.getHttpServer())
        .put(`/user/${senderId}/friend`)
        .set('x-user-id', receiverId.toString())
        .expect(400);
    });

    it('should throw BAD REQUEST when a friend or a pendingReceiver tries to send a friend request', async () => {
      const [senderId, receiverId] = userIds;
      const friendsEntities = generateFriends(
        usersEntities.slice(index, index + 2),
      );
      await dataSource.manager.save(Friends, friendsEntities);
      await userRelationshipStorage.load(receiverId);
      return request(app.getHttpServer())
        .put(`/user/${senderId}/friend`)
        .set('x-user-id', receiverId.toString())
        .expect(400);
    });

    it('should throw BAD REQUEST when a pendingSender tries to accept a friend request', async () => {
      const [senderId, receiverId] = userIds;
      const friendsEntities = generateFriends(
        usersEntities.slice(index, index + 2),
      );
      friendsEntities[0].isAccepted = false;
      await dataSource.manager.save(Friends, friendsEntities);
      await userRelationshipStorage.load(senderId);
      return request(app.getHttpServer())
        .patch(`/user/${receiverId}/friend`)
        .set('x-user-id', senderId.toString())
        .expect(400);
    });

    it('should throw BAD REQUEST when a blocker tries to become a friend with the blocked', async () => {
      const [blockerId, blockedId] = userIds;
      const blockedUsersEntities = generateBlockedUsers(
        usersEntities.slice(index, index + 2),
      );
      await dataSource.manager.save(BlockedUsers, blockedUsersEntities);
      await userRelationshipStorage.load(blockerId);
      const reqObj = request(app.getHttpServer());
      await expect(
        Promise.all([
          reqObj
            .put(`/user/${blockedId}/friend`)
            .set('x-user-id', blockerId.toString())
            .then((res) => expect(res.status).toEqual(400)),
          reqObj
            .patch(`/user/${blockedId}/friend`)
            .set('x-user-id', blockerId.toString())
            .then((res) => expect(res.status).toEqual(400)),
        ]),
      ).resolves.toBeDefined();
    });
  });

  // describe('/user/friends (GET)', () => {
  //   it('no friends', () => {
  //     return request(app.getHttpServer())
  //       .get(`/user/friends`)
  //       .set('x-user-id', userIds[0].toString())
  //       .expect(200)
  //       .expect({ friends: [] });
  //   });

  // it('some friends', async () => {
  //   request(app.getHttpServer())
  //     .get('/user/friends')
  //     .set('x-user-id', userIds[0].toString())
  //     .expect(200)
  //     .expect({ friends: [] });
  // });
  // });
});
