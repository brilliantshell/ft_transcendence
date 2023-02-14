import { DataSource } from 'typeorm';
import { INestApplication } from '@nestjs/common';
import { Socket, io } from 'socket.io-client';
import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { faker } from '@faker-js/faker';
import { nanoid } from 'nanoid';
import * as request from 'supertest';
import waitForExpect from 'wait-for-expect';

import { ActivityManager } from '../src/user-status/activity.manager';
import { AppModule } from '../src/app.module';
import { BannedMembers } from '../src/entity/banned-members.entity';
import { BlockedUsers } from '../src/entity/blocked-users.entity';
import { ChannelId, GameInfo, UserId } from '../src/util/type';
import { ChannelMembers } from '../src/entity/channel-members.entity';
import { ChannelStorage } from '../src/user-status/channel.storage';
import { Channels } from '../src/entity/channels.entity';
import { Friends } from '../src/entity/friends.entity';
import { GameStorage } from '../src/game/game.storage';
import { Messages } from '../src/entity/messages.entity';
import { UserRelationshipStorage } from '../src/user-status/user-relationship.storage';
import { Users } from '../src/entity/users.entity';
import {
  TYPEORM_SHARED_CONFIG,
  createDataSources,
  destroyDataSources,
} from './util/db-resource-manager';
import {
  generateUsers,
  generateBlockedUsers,
  generateFriends,
} from './util/generate-mock-data';
import { listenPromise, timeout } from './util/util';

process.env.NODE_ENV = 'development';
process.env.DB_HOST = 'localhost';

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

describe('UserModule - /user (e2e)', () => {
  let app: INestApplication;
  let clientSockets: Socket[];
  let initDataSource: DataSource;
  let dataSource: DataSource;
  let usersEntities: Users[];
  let allUserIds: UserId[];
  let userIds: UserId[];
  let activityManager: ActivityManager;
  let gameStorage: GameStorage;
  let userRelationshipStorage: UserRelationshipStorage;
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
    activityManager = app.get(ActivityManager);
    gameStorage = app.get(GameStorage);
    userRelationshipStorage = app.get(UserRelationshipStorage);
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
    clientSockets.forEach((clientSocket, i) =>
      clientSocket.emit('currentUi', { userId: userIds[i], ui: 'profile' }),
    );
    await waitForExpect(() => {
      expect(activityManager.getActivity(userIds[0])).not.toBeNull();
      expect(activityManager.getActivity(userIds[1])).not.toBeNull();
    });
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
   * SECTION : UserGuard                                                       *
   *                                                                           *
   ****************************************************************************/

  describe(':userId Param', () => {
    it('should throw BAD REQUEST when the param is invalid', async () => {
      const targetIds = [
        'invalid',
        '-01234',
        '+',
        '0',
        '01234',
        '10000a',
        '123abc321',
      ];
      const reqObj = request(app.getHttpServer());
      const requestsMetaData = targetIds
        .map((targetId) => [
          { path: `/user/${targetId}/block`, method: reqObj.put },
          { path: `/user/${targetId}/block`, method: reqObj.delete },
          { path: `/user/${targetId}/dm`, method: reqObj.put },
          { path: `/user/${targetId}/friend`, method: reqObj.put },
          { path: `/user/${targetId}/friend`, method: reqObj.delete },
          { path: `/user/${targetId}/friend`, method: reqObj.patch },
          { path: `/user/${targetId}/game`, method: reqObj.post },
          { path: `/user/${targetId}/info`, method: reqObj.get },
        ])
        .flat();

      await expect(
        Promise.all(
          requestsMetaData.map(({ path, method }) =>
            method(path)
              .set('x-user-id', userIds[0].toString())
              .then((response) => expect(response.status).toEqual(400)),
          ),
        ),
      ).resolves.toBeDefined();
    });
  });

  describe('UserGuard', () => {
    it('should throw NOT FOUND when the requested user does not exist', async () => {
      let targetId = userIds[0];
      while (allUserIds.includes(targetId)) {
        targetId = faker.datatype.number({ min: 10000, max: 999999 });
      }
      const reqObj = request(app.getHttpServer());
      await expect(
        Promise.all(
          [
            { path: `/user/${targetId}/block`, method: reqObj.put },
            { path: `/user/${targetId}/block`, method: reqObj.delete },
            { path: `/user/${targetId}/dm`, method: reqObj.put },
            { path: `/user/${targetId}/friend`, method: reqObj.put },
            { path: `/user/${targetId}/friend`, method: reqObj.delete },
            { path: `/user/${targetId}/friend`, method: reqObj.patch },
            { path: `/user/${targetId}/game`, method: reqObj.post },
            { path: `/user/${targetId}/info`, method: reqObj.get },
          ].map(({ path, method }) =>
            method(path)
              .set('x-user-id', userIds[0].toString())
              .then((response) => expect(response.status).toEqual(404)),
          ),
        ),
      ).resolves.toBeDefined();
    });

    it('should throw FORBIDDEN when the requester is a blocked user', async () => {
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
          ].map(({ path, method }) =>
            method(path)
              .set('x-user-id', blockedId.toString())
              .then((res) => expect(res.status).toEqual(403)),
          ),
        ),
      ).resolves.toBeDefined();
    });

    it('should throw BAD REQUEST when the requester is a targeting him/herself', async () => {
      const reqObj = request(app.getHttpServer());
      await expect(
        Promise.all(
          [
            { path: `/user/${userIds[0]}/block`, method: reqObj.put },
            { path: `/user/${userIds[0]}/block`, method: reqObj.delete },
            { path: `/user/${userIds[0]}/dm`, method: reqObj.put },
            { path: `/user/${userIds[0]}/friend`, method: reqObj.put },
            { path: `/user/${userIds[0]}/friend`, method: reqObj.delete },
            { path: `/user/${userIds[0]}/friend`, method: reqObj.patch },
            { path: `/user/${userIds[0]}/game`, method: reqObj.post },
          ].map(({ path, method }) =>
            method(path)
              .set('x-user-id', userIds[0].toString())
              .then((res) => expect(res.status).toEqual(400)),
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

    it('should throw NOT FOUND when the requester tries to unblock pendingSender', async () => {
      const friendsEntities = generateFriends(
        usersEntities.slice(index, index + 2),
      );
      friendsEntities[0].isAccepted = false;
      await dataSource.manager.save(Friends, friendsEntities);
      await userRelationshipStorage.load(userIds[0]);
      return request(app.getHttpServer())
        .delete(`/user/${userIds[1]}/block`)
        .set('x-user-id', userIds[0].toString())
        .expect(404);
    });

    it('should throw NOT FOUND when the requester tries to unblock pendingReceiver', async () => {
      const friendsEntities = generateFriends(
        usersEntities.slice(index, index + 2),
      );
      friendsEntities[0].isAccepted = false;
      await dataSource.manager.save(Friends, friendsEntities);
      await userRelationshipStorage.load(userIds[1]);
      return request(app.getHttpServer())
        .delete(`/user/${userIds[0]}/block`)
        .set('x-user-id', userIds[1].toString())
        .expect(404);
    });

    it('should throw NOT FOUND when the requester tries to unblock friend', async () => {
      const friendsEntities = generateFriends(
        usersEntities.slice(index, index + 2),
      );
      friendsEntities[0].isAccepted = true;
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

    it('should throw NOT FOUND when the user tries to accept a non-existing request', () => {
      return request(app.getHttpServer())
        .patch(`/user/${userIds[0]}/friend`)
        .set('x-user-id', userIds[1].toString())
        .expect(404);
    });

    it('should throw BAD REQUEST when a pendingReceiver tries to send a friend request', async () => {
      const [senderId, receiverId] = userIds;
      const friendsEntities = generateFriends(
        usersEntities.slice(index, index + 2),
      );
      friendsEntities[0].isAccepted = false;
      await dataSource.manager.save(Friends, friendsEntities);
      await userRelationshipStorage.load(receiverId);
      return request(app.getHttpServer())
        .put(`/user/${senderId}/friend`)
        .set('x-user-id', receiverId.toString())
        .expect(400);
    });

    it('should throw BAD REQUEST when a friend tries to send a friend request', async () => {
      const [senderId, receiverId] = userIds;
      const friendsEntities = generateFriends(
        usersEntities.slice(index, index + 2),
      );
      friendsEntities[0].isAccepted = true;
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

  /*****************************************************************************
   *                                                                           *
   * SECTION : Block                                                           *
   *                                                                           *
   ****************************************************************************/

  /*****************************************************************************
   *                                                                           *
   * ANCHOR : PUT /user/:userId/block                                          *
   *                                                                           *
   ****************************************************************************/

  describe('PUT /user/:userId/block', () => {
    it('should block a user (201)', async () => {
      const [wsMessage, response] = await Promise.all([
        listenPromise(clientSockets[1], 'userRelationship'),
        request(app.getHttpServer())
          .put(`/user/${userIds[1]}/block`)
          .set('x-user-id', userIds[0].toString()),
      ]);
      expect(wsMessage).toEqual({
        userId: userIds[0],
        relationship: 'blocked',
      });
      expect(response.status).toEqual(201);
      expect(response.body).toEqual({});
    });

    it('should not resend blocked event (200)', async () => {
      const [wsMessage, responseOne] = await Promise.all([
        listenPromise(clientSockets[1], 'userRelationship'),
        request(app.getHttpServer())
          .put(`/user/${userIds[1]}/block`)
          .set('x-user-id', userIds[0].toString()),
      ]);
      expect(wsMessage).toEqual({
        userId: userIds[0],
        relationship: 'blocked',
      });
      expect(responseOne.status).toEqual(201);
      expect(responseOne.body).toEqual({});
      const [wsError, responseTwo] = await Promise.allSettled([
        timeout(1000, listenPromise(clientSockets[1], 'userRelationship')),
        request(app.getHttpServer())
          .put(`/user/${userIds[1]}/block`)
          .set('x-user-id', userIds[0].toString()),
      ]);
      expect(wsError.status).toBe('rejected');
      if (responseTwo.status === 'rejected') {
        fail();
      }
      expect(responseTwo.value.status).toEqual(200);
      expect(responseTwo.value.body).toEqual({});
    });
  });

  /*****************************************************************************
   *                                                                           *
   * ANCHOR : DELETE /user/:userId/block                                       *
   *                                                                           *
   ****************************************************************************/

  describe('DELETE /user/:userId/block', () => {
    it('should unblock a user (200)', async () => {
      const blockEntities = generateBlockedUsers(
        usersEntities.slice(index, index + 2),
      );
      await dataSource.manager.save(BlockedUsers, blockEntities);
      await userRelationshipStorage.load(userIds[0]);
      const [wsMessage, response] = await Promise.all([
        listenPromise(clientSockets[1], 'userRelationship'),
        request(app.getHttpServer())
          .delete(`/user/${userIds[1]}/block`)
          .set('x-user-id', userIds[0].toString()),
      ]);
      expect(wsMessage).toEqual({
        userId: userIds[0],
        relationship: 'normal',
      });
      expect(response.status).toEqual(200);
      expect(response.body).toEqual({});
    });
  });

  /*****************************************************************************
   *                                                                           *
   * SECTION : DM                                                              *
   *                                                                           *
   ****************************************************************************/

  /*****************************************************************************
   *                                                                           *
   * ANCHOR : PUT /user/:userId/dm                                             *
   *                                                                           *
   ****************************************************************************/

  describe('PUT /user/:userId/dm', () => {
    let channelStorage: ChannelStorage;
    let dmId: ChannelId;

    beforeAll(() => {
      channelStorage = app.get(ChannelStorage);
    });

    it('should create a dm (201)', async () => {
      const response = await request(app.getHttpServer())
        .put(`/user/${userIds[1]}/dm`)
        .set('x-user-id', userIds[0].toString());
      const channelMapEntries = channelStorage.getChannels().entries();
      for (const [channelId, { userRoleMap }] of channelMapEntries) {
        if (
          userRoleMap.size == 2 &&
          userRoleMap.has(userIds[0]) &&
          userRoleMap.has(userIds[1]) &&
          !userRelationshipStorage.isBlockedDm(channelId)
        ) {
          dmId = channelId;
          break;
        }
      }
      expect(dmId).toBeDefined();
      expect(response.status).toEqual(201);
      expect(response.headers['location']).toEqual(`/chats/${dmId}`);
    });

    it('should return 200 if the dm already exists', async () => {
      const response = await request(app.getHttpServer())
        .put(`/user/${userIds[1]}/dm`)
        .set('x-user-id', userIds[0].toString());
      expect(response.status).toEqual(201);
      let channelMapEntries = channelStorage.getChannels().entries();
      for (const [channelId, { userRoleMap }] of channelMapEntries) {
        if (
          userRoleMap.size == 2 &&
          userRoleMap.has(userIds[0]) &&
          userRoleMap.has(userIds[1]) &&
          !userRelationshipStorage.isBlockedDm(channelId)
        ) {
          dmId = channelId;
          break;
        }
      }
      expect(dmId).toBeDefined();
      expect(response.headers['location']).toEqual(`/chats/${dmId}`);
      const responseTwo = await request(app.getHttpServer())
        .put(`/user/${userIds[1]}/dm`)
        .set('x-user-id', userIds[0].toString());
      expect(responseTwo.status).toEqual(200);
      channelMapEntries = channelStorage.getChannels().entries();
      for (const [channelId, { userRoleMap }] of channelMapEntries) {
        if (
          userRoleMap.size == 2 &&
          userRoleMap.has(userIds[0]) &&
          userRoleMap.has(userIds[1]) &&
          !userRelationshipStorage.isBlockedDm(channelId)
        ) {
          dmId = channelId;
          break;
        }
      }
      expect(dmId).toBeDefined();
      expect(responseTwo.headers['location']).toEqual(`/chats/${dmId}`);
    });
  });

  /*****************************************************************************
   *                                                                           *
   * SECTION : Friend                                                          *
   *                                                                           *
   ****************************************************************************/

  /*****************************************************************************
   *                                                                           *
   * ANCHOR : GET /user/friends                                                *
   *                                                                           *
   ****************************************************************************/

  describe('GET /user/friends', () => {
    it('no friends', () => {
      return request(app.getHttpServer())
        .get(`/user/friends`)
        .set('x-user-id', userIds[0].toString())
        .expect(200)
        .expect({ friends: [] });
    });

    it('some friends', async () => {
      const newUsersEntities = generateUsers(10).filter(
        ({ userId }) => !allUserIds.includes(userId),
      );
      await dataSource.manager.save(Users, newUsersEntities);
      const friendsEntities: Friends[] = [];
      newUsersEntities.forEach((user, i) =>
        friendsEntities.push(
          ...generateFriends(
            i % 2 === 0
              ? [user, usersEntities[index]]
              : [usersEntities[index], user],
          ),
        ),
      );
      await dataSource.manager.save(Friends, friendsEntities);
      await userRelationshipStorage.load(userIds[0]);
      const response = await request(app.getHttpServer())
        .get('/user/friends')
        .set('x-user-id', userIds[0].toString())
        .expect(200);
      expect(new Set(response.body.friends)).toEqual(
        new Set(newUsersEntities.map(({ userId }) => userId)),
      );
      await dataSource.manager.remove(Friends, friendsEntities);
      await dataSource.manager.remove(Users, newUsersEntities);
    });
  });

  /*****************************************************************************
   *                                                                           *
   * ANCHOR : PUT /user/:userId/friend                                         *
   *                                                                           *
   ****************************************************************************/

  describe('PUT /user/:userId/friend', () => {
    it('should send a friend request (201)', async () => {
      const [wsRelationship, wsRequestDiff, response] = await Promise.all([
        listenPromise(clientSockets[1], 'userRelationship'),
        listenPromise(clientSockets[1], 'friendRequestDiff'),
        request(app.getHttpServer())
          .put(`/user/${userIds[1]}/friend`)
          .set('x-user-id', userIds[0].toString()),
      ]);
      expect(wsRelationship).toEqual({
        userId: userIds[0],
        relationship: 'pendingReceiver',
      });
      expect(wsRequestDiff).toEqual({ requestDiff: 1 });
      expect(response.status).toEqual(201);
      expect(response.body).toEqual({});
    });

    it('should not resend the friend request (200)', async () => {
      const [wsRelationship, wsRequestDiff, responseOne] = await Promise.all([
        timeout(1000, listenPromise(clientSockets[1], 'userRelationship')),
        timeout(1000, listenPromise(clientSockets[1], 'friendRequestDiff')),
        request(app.getHttpServer())
          .put(`/user/${userIds[1]}/friend`)
          .set('x-user-id', userIds[0].toString()),
      ]);
      expect(wsRelationship).toEqual({
        userId: userIds[0],
        relationship: 'pendingReceiver',
      });
      expect(wsRequestDiff).toEqual({ requestDiff: 1 });
      expect(responseOne.status).toEqual(201);
      expect(responseOne.body).toEqual({});
      const [wsErrorRelationship, wsErrorRequestDiff, responseTwo] =
        await Promise.allSettled([
          timeout(1000, listenPromise(clientSockets[1], 'userRelationship')),
          timeout(1000, listenPromise(clientSockets[1], 'friendRequestDiff')),
          request(app.getHttpServer())
            .put(`/user/${userIds[1]}/friend`)
            .set('x-user-id', userIds[0].toString()),
        ]);
      expect(wsErrorRelationship.status).toEqual('rejected');
      expect(wsErrorRequestDiff.status).toEqual('rejected');
      if (responseTwo.status === 'rejected') {
        fail();
      }
      expect(responseTwo.value.status).toEqual(200);
      expect(responseTwo.value.body).toEqual({});
    });
  });

  /*****************************************************************************
   *                                                                           *
   * ANCHOR : DELETE /user/:userId/friend                                      *
   *                                                                           *
   ****************************************************************************/

  describe('DELETE /user/:userId/friend', () => {
    it('should cancel a friend request (200)', async () => {
      const friendEntities = generateFriends(
        usersEntities.slice(index, index + 2),
      );
      friendEntities[0].isAccepted = false;
      await dataSource.manager.save(Friends, friendEntities);
      await userRelationshipStorage.load(userIds[0]);
      const [wsMessage, response] = await Promise.all([
        listenPromise(clientSockets[1], 'userRelationship'),
        request(app.getHttpServer())
          .delete(`/user/${userIds[1]}/friend`)
          .set('x-user-id', userIds[0].toString()),
      ]);
      expect(wsMessage).toEqual({
        userId: userIds[0],
        relationship: 'normal',
      });
      expect(response.status).toEqual(200);
      expect(response.body).toEqual({});
    });

    it('should decline friendship (200)', async () => {
      const friendEntities = generateFriends(
        usersEntities.slice(index, index + 2),
      );
      friendEntities[0].isAccepted = false;
      await dataSource.manager.save(Friends, friendEntities);
      await userRelationshipStorage.load(userIds[1]);
      const [wsMessage, response] = await Promise.all([
        listenPromise(clientSockets[0], 'userRelationship'),
        request(app.getHttpServer())
          .delete(`/user/${userIds[0]}/friend`)
          .set('x-user-id', userIds[1].toString()),
      ]);
      expect(wsMessage).toEqual({
        userId: userIds[1],
        relationship: 'normal',
      });
      expect(response.status).toEqual(200);
      expect(response.body).toEqual({});
    });

    it('should remove friendship (200)', async () => {
      const friendEntities = generateFriends(
        usersEntities.slice(index, index + 2),
      );
      friendEntities[0].isAccepted = true;
      await dataSource.manager.save(Friends, friendEntities);
      await userRelationshipStorage.load(userIds[0]);
      const [wsMessage, response] = await Promise.all([
        listenPromise(clientSockets[1], 'userRelationship'),
        request(app.getHttpServer())
          .delete(`/user/${userIds[1]}/friend`)
          .set('x-user-id', userIds[0].toString()),
      ]);
      expect(wsMessage).toEqual({
        userId: userIds[0],
        relationship: 'normal',
      });
      expect(response.status).toEqual(200);
      expect(response.body).toEqual({});
    });

    it('should remove friendship by receiver (200)', async () => {
      const friendEntities = generateFriends(
        usersEntities.slice(index, index + 2),
      );
      friendEntities[0].isAccepted = true;
      await dataSource.manager.save(Friends, friendEntities);
      await userRelationshipStorage.load(userIds[1]);
      const [wsMessage, response] = await Promise.all([
        listenPromise(clientSockets[0], 'userRelationship'),
        request(app.getHttpServer())
          .delete(`/user/${userIds[0]}/friend`)
          .set('x-user-id', userIds[1].toString()),
      ]);
      expect(wsMessage).toEqual({
        userId: userIds[1],
        relationship: 'normal',
      });
      expect(response.status).toEqual(200);
      expect(response.body).toEqual({});
    });
  });

  /*****************************************************************************
   *                                                                           *
   * ANCHOR : PATCH /user/:userId/friend                                       *
   *                                                                           *
   ****************************************************************************/

  describe('PATCH /user/:userId/friend', () => {
    it('should accept a friend request (200)', async () => {
      const friendEntities = generateFriends(
        usersEntities.slice(index, index + 2),
      );
      friendEntities[0].isAccepted = false;
      await dataSource.manager.save(Friends, friendEntities);
      await userRelationshipStorage.load(userIds[1]);
      const [wsMessage, response] = await Promise.all([
        listenPromise(clientSockets[0], 'userRelationship'),
        request(app.getHttpServer())
          .patch(`/user/${userIds[0]}/friend`)
          .set('x-user-id', userIds[1].toString()),
      ]);
      expect(wsMessage).toEqual({
        userId: userIds[1],
        relationship: 'friend',
      });
      expect(response.status).toEqual(200);
      expect(response.body).toEqual({});
    });

    it('should not resend a WS event when the request is accepted again', async () => {
      const friendEntities = generateFriends(
        usersEntities.slice(index, index + 2),
      );
      friendEntities[0].isAccepted = true;
      await dataSource.manager.save(Friends, friendEntities);
      await userRelationshipStorage.load(userIds[1]);
      const [wsError, response] = await Promise.allSettled([
        timeout(1000, listenPromise(clientSockets[0], 'userRelationship')),
        request(app.getHttpServer())
          .patch(`/user/${userIds[0]}/friend`)
          .set('x-user-id', userIds[1].toString()),
      ]);
      expect(wsError.status).toBe('rejected');
      if (response.status === 'rejected') {
        fail();
      }
      expect(response.value.status).toEqual(200);
      expect(response.value.body).toEqual({});
    });
  });

  /*****************************************************************************
   *                                                                           *
   * SECTION : Game                                                            *
   *                                                                           *
   ****************************************************************************/

  /*****************************************************************************
   *                                                                           *
   * ANCHOR : POST /user/:userId/game                                          *
   *                                                                           *
   ****************************************************************************/

  describe('POST /user/:userId/game', () => {
    beforeEach(async () => {
      userIds.push(allUserIds[index + 2]);
      clientSockets.push(
        io('http://localhost:4241', {
          extraHeaders: { 'x-user-id': userIds[2].toString() },
        }),
      );
      await listenPromise(clientSockets[2], 'connect');
      clientSockets[2].emit('currentUi', { userId: userIds[2], ui: 'profile' }),
        await waitForExpect(() => {
          expect(activityManager.getActivity(userIds[2])).not.toBeNull();
        });
    });

    afterEach(() => {
      index++;
    });

    it('should create a normal game (201)', async () => {
      const [inviterId, invitedId] = userIds;
      const [wsMessage, { headers, status }] = await Promise.all([
        listenPromise(clientSockets[1], 'newGame'),
        request(app.getHttpServer())
          .post(`/user/${invitedId}/game`)
          .set('x-user-id', inviterId.toString())
          .then(({ headers, status }) => {
            return { headers, status };
          }),
      ]);
      expect(status).toEqual(201);
      expect(headers.location).toMatch(/\/game\/[0-9A-Za-z_-]{21}$/);
      const gameId = headers.location.split('/').pop();
      const gameInfo = gameStorage.getGame(gameId);
      expect(gameInfo).toBeDefined();
      expect(gameInfo.isRank).toBeFalsy();
      expect(wsMessage).toEqual({ gameId });
    });

    it('should throw BAD REQUEST if the inviter is in game ', async () => {
      const [inviterId, invitedId, playerId] = userIds;
      const gameId = nanoid();
      await gameStorage.createGame(
        gameId,
        new GameInfo(inviterId, playerId, 1, false),
      );
      const [success, fail] = await Promise.allSettled([
        request(app.getHttpServer())
          .post(`/user/${invitedId}/game`)
          .set('x-user-id', inviterId.toString())
          .expect(400),
        timeout(1000, listenPromise(clientSockets[1], 'newGame')),
      ]);
      expect(success.status).toBe('fulfilled');
      expect(fail.status).toBe('rejected');
      gameStorage.deleteGame(gameId);
    });

    it('should throw CONFLICT if the invited is in game ', async () => {
      const [inviterId, invitedId, playerId] = userIds;
      const gameId = nanoid();
      await gameStorage.createGame(
        gameId,
        new GameInfo(invitedId, playerId, 1, false),
      );
      const [success, fail] = await Promise.allSettled([
        request(app.getHttpServer())
          .post(`/user/${invitedId}/game`)
          .set('x-user-id', inviterId.toString())
          .expect(409),
        timeout(1000, listenPromise(clientSockets[1], 'newGame')),
      ]);
      expect(success.status).toBe('fulfilled');
      expect(fail.status).toBe('rejected');
      gameStorage.deleteGame(gameId);
    });
  });

  /*****************************************************************************
   *                                                                           *
   * SECTION : User Profile                                                    *
   *                                                                           *
   ****************************************************************************/

  /*****************************************************************************
   *                                                                           *
   * ANCHOR : GET /user/id                                                     *
   *                                                                           *
   ****************************************************************************/

  describe('GET /user/id', () => {
    it('should return user id (200)', () => {
      return request(app.getHttpServer())
        .get('/user/id')
        .set('x-user-id', userIds[0].toString())
        .expect(200)
        .expect({ userId: userIds[0] });
    });
  });

  /*****************************************************************************
   *                                                                           *
   * ANCHOR : GET /user/:userId/info                                           *
   *                                                                           *
   ****************************************************************************/

  describe('GET /:userId/info', () => {
    it('should return null profileImage', async () => {
      const [requesterId, targetId] = userIds;
      await dataSource.manager.update(Users, targetId, {
        isDefaultImage: false,
      });
      const response = await request(app.getHttpServer())
        .get(`/user/${targetId}/info`)
        .set('x-user-id', requesterId.toString());
      expect(response.status).toEqual(200);
      expect(response.body).toEqual({
        nickname: usersEntities[index + 1].nickname,
        isDefaultImage: false,
      });
    });

    it('should return nickname, profileImage (HTTP) & online, normal (WS) (both are logged in)', async () => {
      const [requesterId, targetId] = userIds;
      const [wsMessage, response] = await Promise.all([
        listenPromise(clientSockets[0], 'userActivity'),
        request(app.getHttpServer())
          .get(`/user/${targetId}/info`)
          .set('x-user-id', requesterId.toString()),
      ]);
      expect(wsMessage).toEqual({
        activity: 'online',
        gameId: null,
        userId: targetId,
      });
      expect(response.status).toEqual(200);
      expect(response.body).toEqual({
        nickname: usersEntities[index + 1].nickname,
        isDefaultImage: usersEntities[index + 1].isDefaultImage,
      });
    });

    it('should return nickname, profileImage (HTTP) & offline, normal (WS) (only the requester is logged in)', async () => {
      const [requesterId, targetId] = userIds;
      clientSockets[1].disconnect();
      await waitForExpect(() => {
        expect(activityManager.getActivity(targetId)).toBeNull();
      });
      const [wsMessage, response] = await Promise.all([
        listenPromise(clientSockets[0], 'userActivity'),
        request(app.getHttpServer())
          .get(`/user/${targetId}/info`)
          .set('x-user-id', requesterId.toString()),
      ]);
      expect(wsMessage).toEqual({
        activity: 'offline',
        gameId: null,
        userId: targetId,
      });
      expect(response.status).toEqual(200);
      expect(response.body).toEqual({
        nickname: usersEntities[index + 1].nickname,
        isDefaultImage: usersEntities[index + 1].isDefaultImage,
      });
    });

    it('should return online, blocker (WS) (both are logged in)', async () => {
      const [requesterId, targetId] = userIds;
      const blockedUsersEntities = generateBlockedUsers(
        usersEntities.slice(index, index + 2),
      );
      await dataSource.manager.save(BlockedUsers, blockedUsersEntities);
      await userRelationshipStorage.load(requesterId);
      const [wsMessage] = await Promise.all([
        listenPromise(clientSockets[0], 'userActivity'),
        request(app.getHttpServer())
          .get(`/user/${targetId}/info`)
          .set('x-user-id', requesterId.toString()),
      ]);
      expect(wsMessage).toEqual({
        activity: 'online',
        gameId: null,
        userId: targetId,
      });
    });

    it('should return offline, blocked (WS) (only the requester is logged in)', async () => {
      const [targetId, requesterId] = userIds;
      const blockedUsersEntities = generateBlockedUsers(
        usersEntities.slice(index, index + 2),
      );
      await dataSource.manager.save(BlockedUsers, blockedUsersEntities);
      await userRelationshipStorage.load(requesterId);
      clientSockets[0].disconnect();
      await waitForExpect(() => {
        expect(activityManager.getActivity(targetId)).toBeNull();
      });
      const [wsMessage] = await Promise.all([
        listenPromise(clientSockets[1], 'userActivity'),
        request(app.getHttpServer())
          .get(`/user/${targetId}/info`)
          .set('x-user-id', requesterId.toString()),
      ]);
      expect(wsMessage).toEqual({
        activity: 'offline',
        gameId: null,
        userId: targetId,
      });
    });

    it('should return online, pendingSender (WS) (both are logged in)', async () => {
      const [requesterId, targetId] = userIds;
      const friendsEntities = generateFriends(
        usersEntities.slice(index, index + 2),
      );
      friendsEntities[0].isAccepted = false;
      await dataSource.manager.save(Friends, friendsEntities);
      await userRelationshipStorage.load(requesterId);
      const [wsMessage] = await Promise.all([
        listenPromise(clientSockets[0], 'userActivity'),
        request(app.getHttpServer())
          .get(`/user/${targetId}/info`)
          .set('x-user-id', requesterId.toString()),
      ]);
      expect(wsMessage).toEqual({
        activity: 'online',
        gameId: null,
        userId: targetId,
      });
    });

    it('should return offline, pendingReceiver (WS) (only the requester is logged in)', async () => {
      const [targetId, requesterId] = userIds;
      const friendsEntities = generateFriends(
        usersEntities.slice(index, index + 2),
      );
      friendsEntities[0].isAccepted = false;
      await dataSource.manager.save(Friends, friendsEntities);
      await userRelationshipStorage.load(requesterId);
      clientSockets[0].disconnect();
      await waitForExpect(() => {
        expect(activityManager.getActivity(targetId)).toBeNull();
      });
      const [wsMessage] = await Promise.all([
        listenPromise(clientSockets[1], 'userActivity'),
        request(app.getHttpServer())
          .get(`/user/${targetId}/info`)
          .set('x-user-id', requesterId.toString()),
      ]);
      expect(wsMessage).toEqual({
        activity: 'offline',
        gameId: null,
        userId: targetId,
      });
    });

    it('should return online, friend (WS) (both are logged in)', async () => {
      const [requesterId, targetId] = userIds;
      const friendsEntities = generateFriends(
        usersEntities.slice(index, index + 2),
      );
      friendsEntities[0].isAccepted = true;
      await dataSource.manager.save(Friends, friendsEntities);
      await userRelationshipStorage.load(requesterId);
      const [wsMessage] = await Promise.all([
        listenPromise(clientSockets[0], 'userActivity'),
        request(app.getHttpServer())
          .get(`/user/${targetId}/info`)
          .set('x-user-id', requesterId.toString()),
      ]);
      expect(wsMessage).toEqual({
        activity: 'online',
        gameId: null,
        userId: targetId,
      });
    });
    // TODO - GAME TEST
  });
});
