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

const PORT = 4241;
const URL = `http://localhost:${PORT}`;

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
    usersEntities = generateUsers(120);
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
    await app.listen(PORT);
    activityManager = app.get(ActivityManager);
    gameStorage = app.get(GameStorage);
    userRelationshipStorage = app.get(UserRelationshipStorage);
  });

  beforeEach(async () => {
    userIds = [allUserIds[index], allUserIds[index + 1]];
    clientSockets = [
      io(URL, { extraHeaders: { 'x-user-id': userIds[0].toString() } }),
      io(URL, { extraHeaders: { 'x-user-id': userIds[1].toString() } }),
    ];
    await Promise.all(
      clientSockets.map(
        (socket) =>
          new Promise((resolve) => socket.on('connect', () => resolve('done'))),
      ),
    );
    clientSockets.forEach((clientSocket) =>
      clientSocket.emit('currentUi', { ui: 'profile' }),
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
      await Promise.all([
        userRelationshipStorage.load(userIds[0]),
        userRelationshipStorage.load(userIds[1]),
      ]);
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
      await Promise.all([
        userRelationshipStorage.load(userIds[0]),
        userRelationshipStorage.load(userIds[1]),
      ]);
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
      expect(responseTwo.value.status).toEqual(204);
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
      expect(response.status).toEqual(204);
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
      await Promise.all([
        channelStorage.loadUser(userIds[0]),
        channelStorage.loadUser(userIds[1]),
      ]);
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
      await Promise.all([
        channelStorage.loadUser(userIds[0]),
        channelStorage.loadUser(userIds[1]),
      ]);
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
      expect(responseTwo.status).toEqual(204);
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
    it('no friends', async () => {
      await userRelationshipStorage.load(userIds[0]);
      return request(app.getHttpServer())
        .get(`/user/friends`)
        .set('x-user-id', userIds[0].toString())
        .expect(200)
        .expect({ friends: [], pendingSenders: [], pendingReceivers: [] });
    });

    it('some friends', async () => {
      const newUsersEntities = generateUsers(100).filter(
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
        new Set(
          newUsersEntities
            .filter(({ userId }) => {
              const friend = friendsEntities.find(
                ({ senderId, receiverId }) =>
                  userId === senderId || userId === receiverId,
              );
              return friend && friend.isAccepted;
            })
            .map(({ userId }) => userId),
        ),
      );
      expect(new Set(response.body.pendingSenders)).toEqual(
        new Set(
          newUsersEntities
            .filter(({ userId }) => {
              const friend = friendsEntities.find(
                ({ receiverId }) => userId === receiverId,
              );
              return friend && !friend.isAccepted;
            })
            .map(({ userId }) => userId),
        ),
      );
      expect(new Set(response.body.pendingReceivers)).toEqual(
        new Set(
          newUsersEntities
            .filter(({ userId }) => {
              const friend = friendsEntities.find(
                ({ senderId }) => userId === senderId,
              );
              return friend && !friend.isAccepted;
            })
            .map(({ userId }) => userId),
        ),
      );
      await dataSource.manager.remove(Friends, friendsEntities);
      await dataSource.manager.remove(Users, newUsersEntities);
    });

    it('should emit the count of pending friend requests when a user is connected', async () => {
      const newUsersEntities = generateUsers(30).filter(
        ({ userId }) => !allUserIds.includes(userId),
      );
      const newFriendRequests: Friends[] = [];
      let countPending = 0;
      newUsersEntities.forEach((user, i) => {
        if (i === 0) {
          return;
        }
        const [newFriend] = generateFriends([user, newUsersEntities[0]]);
        newFriend.isAccepted === false && countPending++;
        newFriendRequests.push(newFriend);
      });
      await dataSource.manager.save(Users, newUsersEntities);
      await dataSource.manager.save(Friends, newFriendRequests);
      const [_, requestDiff] = await Promise.all([
        clientSockets.push(
          io(URL, {
            extraHeaders: {
              'x-user-id': newUsersEntities[0].userId.toString(),
            },
          }),
        ),
        userRelationshipStorage
          .load(newUsersEntities[0].userId)
          .then(() => listenPromise(clientSockets[2], 'friendRequestDiff')),
      ]);
      expect(requestDiff).toEqual({ requestDiff: countPending });
    });
  });

  /*****************************************************************************
   *                                                                           *
   * ANCHOR : PUT /user/:userId/friend                                         *
   *                                                                           *
   ****************************************************************************/

  describe('PUT /user/:userId/friend', () => {
    it('should send a friend request (201)', async () => {
      await userRelationshipStorage.load(userIds[0]);
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
      await userRelationshipStorage.load(userIds[0]);
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
      expect(responseTwo.value.status).toEqual(204);
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
      expect(response.status).toEqual(204);
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
      expect(response.status).toEqual(204);
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
      expect(response.status).toEqual(204);
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
      expect(response.status).toEqual(204);
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
      expect(response.status).toEqual(204);
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
      expect(response.value.status).toEqual(204);
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
        io(URL, {
          extraHeaders: { 'x-user-id': userIds[2].toString() },
        }),
      );
      await listenPromise(clientSockets[2], 'connect');
      clientSockets[2].emit('currentUi', { ui: 'profile' }),
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
        listenPromise(clientSockets[1], 'newNormalGame'),
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
      expect(wsMessage).toEqual({
        gameId,
        inviterNickname: usersEntities[index].nickname,
      });
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
      const [wsActivity, wsRelationship, response, wsErrorOne, wsErrorTwo] =
        await Promise.allSettled([
          listenPromise(clientSockets[0], 'userActivity'),
          listenPromise(clientSockets[0], 'userRelationship'),
          request(app.getHttpServer())
            .get(`/user/${targetId}/info`)
            .set('x-user-id', requesterId.toString()),
          timeout(500, listenPromise(clientSockets[1], 'userActivity')),
          timeout(500, listenPromise(clientSockets[1], 'userRelationship')),
        ]);
      expect(wsErrorOne.status).toBe('rejected');
      expect(wsErrorTwo.status).toBe('rejected');
      expect(wsActivity.status).toBe('fulfilled');
      expect(wsRelationship.status).toBe('fulfilled');
      expect(response.status).toBe('fulfilled');
      if (
        wsActivity.status === 'rejected' ||
        wsRelationship.status === 'rejected' ||
        response.status === 'rejected'
      ) {
        fail();
      }
      expect(wsActivity.value).toEqual({
        activity: 'online',
        gameId: null,
        userId: targetId,
      });
      expect(wsRelationship.value).toEqual({
        relationship: 'normal',
        userId: targetId,
      });
      expect(response.value.status).toEqual(200);
      expect(response.value.body).toEqual({
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
      const [wsActivity, wsRelationship, response] = await Promise.all([
        listenPromise(clientSockets[0], 'userActivity'),
        listenPromise(clientSockets[0], 'userRelationship'),
        request(app.getHttpServer())
          .get(`/user/${targetId}/info`)
          .set('x-user-id', requesterId.toString()),
      ]);
      expect(wsActivity).toEqual({
        activity: 'offline',
        gameId: null,
        userId: targetId,
      });
      expect(wsRelationship).toEqual({
        relationship: 'normal',
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
      const [wsActivity, wsRelationship, wsErrorOne, wsErrorTwo] =
        await Promise.allSettled([
          listenPromise(clientSockets[0], 'userActivity'),
          listenPromise(clientSockets[0], 'userRelationship'),
          timeout(500, listenPromise(clientSockets[1], 'userActivity')),
          timeout(500, listenPromise(clientSockets[1], 'userRelationship')),
          request(app.getHttpServer())
            .get(`/user/${targetId}/info`)
            .set('x-user-id', requesterId.toString()),
        ]);
      expect(wsErrorOne.status).toEqual('rejected');
      expect(wsErrorTwo.status).toEqual('rejected');
      if (
        wsActivity.status === 'rejected' ||
        wsRelationship.status === 'rejected'
      ) {
        fail();
      }
      expect(wsActivity.value).toEqual({
        activity: 'online',
        gameId: null,
        userId: targetId,
      });
      expect(wsRelationship.value).toEqual({
        relationship: 'blocker',
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
      const [wsActivity, wsRelationship] = await Promise.all([
        listenPromise(clientSockets[1], 'userActivity'),
        listenPromise(clientSockets[1], 'userRelationship'),
        request(app.getHttpServer())
          .get(`/user/${targetId}/info`)
          .set('x-user-id', requesterId.toString()),
      ]);
      expect(wsActivity).toEqual({
        activity: 'offline',
        gameId: null,
        userId: targetId,
      });
      expect(wsRelationship).toEqual({
        relationship: 'blocked',
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
      const [wsActivity, wsRelationship, wsErrorOne, wsErrorTwo] =
        await Promise.allSettled([
          listenPromise(clientSockets[0], 'userActivity'),
          listenPromise(clientSockets[0], 'userRelationship'),
          timeout(500, listenPromise(clientSockets[1], 'userActivity')),
          timeout(500, listenPromise(clientSockets[1], 'userRelationship')),
          request(app.getHttpServer())
            .get(`/user/${targetId}/info`)
            .set('x-user-id', requesterId.toString()),
        ]);
      expect(wsErrorOne.status).toEqual('rejected');
      expect(wsErrorTwo.status).toEqual('rejected');
      if (
        wsActivity.status === 'rejected' ||
        wsRelationship.status === 'rejected'
      ) {
        fail();
      }
      expect(wsActivity.value).toEqual({
        activity: 'online',
        gameId: null,
        userId: targetId,
      });
      expect(wsRelationship.value).toEqual({
        relationship: 'pendingSender',
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
      const [wsActivity, wsRelationship] = await Promise.all([
        listenPromise(clientSockets[1], 'userActivity'),
        listenPromise(clientSockets[1], 'userRelationship'),
        request(app.getHttpServer())
          .get(`/user/${targetId}/info`)
          .set('x-user-id', requesterId.toString()),
      ]);
      expect(wsActivity).toEqual({
        activity: 'offline',
        gameId: null,
        userId: targetId,
      });
      expect(wsRelationship).toEqual({
        relationship: 'pendingReceiver',
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
      const [wsActivity, wsRelationship, wsErrorOne, wsErrorTwo] =
        await Promise.allSettled([
          listenPromise(clientSockets[0], 'userActivity'),
          listenPromise(clientSockets[0], 'userRelationship'),
          timeout(500, listenPromise(clientSockets[1], 'userActivity')),
          timeout(500, listenPromise(clientSockets[1], 'userRelationship')),
          request(app.getHttpServer())
            .get(`/user/${targetId}/info`)
            .set('x-user-id', requesterId.toString()),
        ]);
      expect(wsErrorOne.status).toEqual('rejected');
      expect(wsErrorTwo.status).toEqual('rejected');
      if (
        wsActivity.status === 'rejected' ||
        wsRelationship.status === 'rejected'
      ) {
        fail();
      }
      expect(wsActivity.value).toEqual({
        activity: 'online',
        gameId: null,
        userId: targetId,
      });
      expect(wsRelationship.value).toEqual({
        relationship: 'friend',
        userId: targetId,
      });
    });

    it('should return online, inGame (WS) (both are logged in)', async () => {
      const [requesterId, targetId] = userIds;
      const gameId = nanoid();
      await gameStorage.createGame(
        gameId,
        new GameInfo(requesterId, targetId, 1, true),
      );
      clientSockets.forEach((socket) =>
        socket.emit('currentUi', { ui: `game-${gameId}` }),
      );
      await waitForExpect(() => {
        expect(activityManager.getActivity(requesterId)).toEqual(
          `game-${gameId}`,
        );
        expect(activityManager.getActivity(targetId)).toEqual(`game-${gameId}`);
      });
      const [wsMessage] = await Promise.all([
        listenPromise(clientSockets[0], 'userActivity'),
        request(app.getHttpServer())
          .get(`/user/${targetId}/info`)
          .set('x-user-id', requesterId.toString()),
      ]);
      expect(wsMessage).toEqual({
        activity: 'inGame',
        gameId,
        userId: targetId,
      });
      gameStorage.deleteGame(gameId);
    });

    it("should notify the watcher of the target's activity when the target connects and disconnects (WS)", async () => {
      userIds.push(usersEntities[index + 2].userId);
      const [wsConnected, wsConnectError] = await Promise.allSettled([
        listenPromise(clientSockets[0], 'userActivity'),
        timeout(500, listenPromise(clientSockets[1], 'userActivity')),
        clientSockets.push(
          io(URL, { extraHeaders: { 'x-user-id': userIds[2].toString() } }),
        ),
        listenPromise(clientSockets[2], 'connect')
          .then(() => clientSockets[2].emit('currentUi', { ui: 'profile' }))
          .then(() =>
            waitForExpect(() =>
              expect(activityManager.getActivity(userIds[2])).not.toBeNull(),
            ),
          )
          .then(() =>
            request(app.getHttpServer())
              .get(`/user/${userIds[2]}/info`)
              .set('x-user-id', userIds[0].toString()),
          ),
      ]);
      expect(wsConnectError.status).toEqual('rejected');
      if (wsConnected.status === 'rejected') {
        fail();
      }
      expect(wsConnected.value).toEqual({
        activity: 'online',
        gameId: null,
        userId: userIds[2],
      });
      const [wsDisconnected, wsDisconnectError] = await Promise.allSettled([
        listenPromise(clientSockets[0], 'userActivity'),
        timeout(500, listenPromise(clientSockets[1], 'userActivity')),
        clientSockets[2].disconnect(),
      ]);
      expect(wsDisconnectError.status).toEqual('rejected');
      if (wsDisconnected.status === 'rejected') {
        fail();
      }
      expect(wsDisconnected.value).toEqual({
        activity: 'offline',
        gameId: null,
        userId: userIds[2],
      });
      index += 1;
    });

    it("should not notify the watcher of the target's activity when the request is from friendToggleList and it is closed (WS)", async () => {
      userIds.push(usersEntities[index + 2].userId);
      clientSockets[0].emit('friendListOpened');
      const [wsConnected, wsConnectError] = await Promise.allSettled([
        listenPromise(clientSockets[0], 'userActivity'),
        timeout(500, listenPromise(clientSockets[1], 'userActivity')),
        clientSockets.push(
          io(URL, { extraHeaders: { 'x-user-id': userIds[2].toString() } }),
        ),
        listenPromise(clientSockets[2], 'connect')
          .then(() => clientSockets[2].emit('currentUi', { ui: 'profile' }))
          .then(() =>
            waitForExpect(() =>
              expect(activityManager.getActivity(userIds[2])).not.toBeNull(),
            ),
          )
          .then(() =>
            request(app.getHttpServer())
              .get(`/user/${userIds[2]}/info`)
              .set('x-user-id', userIds[0].toString()),
          ),
      ]);
      expect(wsConnectError.status).toEqual('rejected');
      if (wsConnected.status === 'rejected') {
        fail();
      }
      expect(wsConnected.value).toEqual({
        activity: 'online',
        gameId: null,
        userId: userIds[2],
      });
      clientSockets[0].emit('friendListClosed');
      const [wsDisconnectErrorOne, wsDisconnectErrorTwo] =
        await Promise.allSettled([
          timeout(500, listenPromise(clientSockets[0], 'userActivity')),
          timeout(500, listenPromise(clientSockets[1], 'userActivity')),
          clientSockets[2].disconnect(),
        ]);
      expect(wsDisconnectErrorOne.status).toEqual('rejected');
      expect(wsDisconnectErrorTwo.status).toEqual('rejected');
      index += 1;
    });

    it("should still notify the watcher of the target's activity when the request had been made before opening the friendToggleList \
    and then another request is originated from friendToggleList and it is closed (WS)", async () => {
      userIds.push(usersEntities[index + 2].userId);
      const [wsConnected, wsConnectError] = await Promise.allSettled([
        listenPromise(clientSockets[0], 'userActivity'),
        timeout(500, listenPromise(clientSockets[1], 'userActivity')),
        clientSockets.push(
          io(URL, { extraHeaders: { 'x-user-id': userIds[2].toString() } }),
        ),
        listenPromise(clientSockets[2], 'connect')
          .then(() => clientSockets[2].emit('currentUi', { ui: 'profile' }))
          .then(() =>
            waitForExpect(() =>
              expect(activityManager.getActivity(userIds[2])).not.toBeNull(),
            ),
          )
          .then(() =>
            request(app.getHttpServer())
              .get(`/user/${userIds[2]}/info`)
              .set('x-user-id', userIds[0].toString()),
          ),
      ]);
      expect(wsConnectError.status).toEqual('rejected');
      if (wsConnected.status === 'rejected') {
        fail();
      }
      expect(wsConnected.value).toEqual({
        activity: 'online',
        gameId: null,
        userId: userIds[2],
      });
      clientSockets[0].emit('friendListOpened');
      const [wsDisconnected, wsDisconnectError] = await Promise.allSettled([
        listenPromise(clientSockets[0], 'userActivity'),
        timeout(500, listenPromise(clientSockets[1], 'userActivity')),
        clientSockets[2].disconnect(),
      ]);
      expect(wsDisconnectError.status).toEqual('rejected');
      if (wsDisconnected.status === 'rejected') {
        fail();
      }
      expect(wsDisconnected.value).toEqual({
        activity: 'offline',
        gameId: null,
        userId: userIds[2],
      });
      clientSockets.pop();
      clientSockets[0].emit('friendListClosed');
      const [wsReconnected, wsReconnectError] = await Promise.allSettled([
        listenPromise(clientSockets[0], 'userActivity'),
        timeout(500, listenPromise(clientSockets[1], 'userActivity')),
        clientSockets.push(
          io(URL, { extraHeaders: { 'x-user-id': userIds[2].toString() } }),
        ),
        listenPromise(clientSockets[2], 'connect')
          .then(() => clientSockets[2].emit('currentUi', { ui: 'profile' }))
          .then(() =>
            waitForExpect(() =>
              expect(activityManager.getActivity(userIds[2])).not.toBeNull(),
            ),
          )
          .then(() =>
            request(app.getHttpServer())
              .get(`/user/${userIds[2]}/info`)
              .set('x-user-id', userIds[0].toString()),
          ),
      ]);
      expect(wsReconnectError.status).toEqual('rejected');
      if (wsReconnected.status === 'rejected') {
        fail();
      }
      expect(wsReconnected.value).toEqual({
        activity: 'online',
        gameId: null,
        userId: userIds[2],
      });
      index += 1;
    });

    it('should not notify the previous watcher when the watcher changes its UI (WS)', async () => {
      userIds.push(usersEntities[index + 2].userId);
      const [wsConnected] = await Promise.all([
        listenPromise(clientSockets[0], 'userActivity'),
        clientSockets.push(
          io(URL, { extraHeaders: { 'x-user-id': userIds[2].toString() } }),
        ),
        listenPromise(clientSockets[2], 'connect')
          .then(() => clientSockets[2].emit('currentUi', { ui: 'profile' }))
          .then(() =>
            waitForExpect(() =>
              expect(activityManager.getActivity(userIds[2])).not.toBeNull(),
            ),
          )
          .then(() =>
            request(app.getHttpServer())
              .get(`/user/${userIds[2]}/info`)
              .set('x-user-id', userIds[0].toString()),
          ),
      ]);
      expect(wsConnected).toEqual({
        activity: 'online',
        gameId: null,
        userId: userIds[2],
      });
      clientSockets[0].emit('currentUi', { ui: 'chats' });
      const [wsError] = await Promise.allSettled([
        timeout(500, listenPromise(clientSockets[0], 'userActivity')),
        clientSockets[2].disconnect(),
      ]);
      expect(wsError.status).toEqual('rejected');
      index += 1;
    });
  });
});
