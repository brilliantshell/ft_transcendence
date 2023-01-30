import { UserSocketStorage } from './../src/user-status/user-socket.storage';
import { UserRelationshipStorage } from './../src/user-status/user-relationship.storage';
import { INestApplication } from '@nestjs/common';
import { Socket, io } from 'socket.io-client';
import { Test, TestingModule } from '@nestjs/testing';
import { faker } from '@faker-js/faker';
import { getRepositoryToken } from '@nestjs/typeorm';
import waitForExpect from 'wait-for-expect';

import { ActivityManager } from '../src/user-status/activity.manager';
import { AppModule } from '../src/app.module';
import { BlockedUsers } from '../src/entity/blocked-users.entity';
import { Friends } from '../src/entity/friends.entity';
import { UserGateway } from '../src/user/user.gateway';
import { Activity, UserId } from '../src/util/type';
import { UserInfoDto } from '../src/user/dto/user-info.dto';
import { Users } from '../src/entity/users.entity';
import {
  generateUsers,
  generateFriends,
  generateBlockedUsers,
} from './generate-mock-data';
import {
  mockBlockedUsersRepositoryFactory,
  mockFriendsRepositoryFactory,
  mockUsersRepositoryFactory,
} from './mock.repositories';

enum Relationships {
  NORMAL,
  FRIEND,
  BLOCKED,
}

const ONLINE = true;
const OFFLINE = false;

describe('UserStatusModule (e2e)', () => {
  let app: INestApplication;
  let usersEntities: Users[];
  let gateway: UserGateway;
  let activityManager: ActivityManager;
  let userRelationshipStorage: UserRelationshipStorage;

  beforeAll(async () => {
    usersEntities = generateUsers(100);
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(getRepositoryToken(Users))
      .useValue(mockUsersRepositoryFactory(usersEntities))
      .overrideProvider(getRepositoryToken(Friends))
      .useValue(
        mockFriendsRepositoryFactory(
          generateFriends(usersEntities.slice(40, 70)),
        ),
      )
      .overrideProvider(getRepositoryToken(BlockedUsers))
      .useValue(
        mockBlockedUsersRepositoryFactory(
          generateBlockedUsers(usersEntities.slice(70, 100)),
        ),
      )
      .compile();
    app = moduleFixture.createNestApplication();
    await app.init();
    await app.listen(4244);
    gateway = moduleFixture.get(UserGateway);
    activityManager = moduleFixture.get(ActivityManager);
    userRelationshipStorage = moduleFixture.get(UserRelationshipStorage);
  });

  afterAll(async () => {
    await app.close();
  });

  /*****************************************************************************
   *                                                                           *
   * SECTION : emitUserInfo                                                    *
   *                                                                           *
   ****************************************************************************/

  describe('emitUserInfo', () => {
    let requesterSocket: Socket;
    let requestedSocket: Socket;

    afterEach(() => {
      requesterSocket.close();
      requestedSocket?.close();
    });

    it('should send online & normal for self', async () => {
      const clients = await createClients(
        usersEntities,
        OFFLINE,
        Relationships.NORMAL,
      );
      const requesterId = clients[0].id;
      const requestedId = clients[0].id;
      requesterSocket = clients[0].socket;
      await waitForExpect(() =>
        expect(activityManager.getActivity(requesterId)).not.toBeNull(),
      );
      gateway.emitUserInfo(
        requesterSocket.id,
        createUserInfoDto(requesterId, requestedId),
      );
      const data: UserInfoDto = await new Promise((resolve) =>
        requesterSocket.on('userInfo', (data) => resolve(data)),
      );
      expect(data).toEqual({
        activity: 'online',
        gameId: null,
        relationship: 'normal',
        userId: requestedId,
      });
    });

    it('should send offline & normal', async () => {
      const clients = await createClients(
        usersEntities,
        OFFLINE,
        Relationships.NORMAL,
      );
      const requesterId = clients[0].id;
      const requestedId = clients[1].id;
      requesterSocket = clients[0].socket;
      await waitForExpect(() =>
        expect(activityManager.getActivity(requesterId)).not.toBeNull(),
      );
      gateway.emitUserInfo(
        requesterSocket.id,
        createUserInfoDto(requesterId, requestedId),
      );
      const data = await new Promise((resolve) =>
        requesterSocket.on('userInfo', (data) => resolve(data)),
      );
      expect(data).toEqual({
        activity: 'offline',
        gameId: null,
        relationship: 'normal',
        userId: requestedId,
      });
    });

    it('should send online & blocked | blocker', async () => {
      const clients = await createClients(
        usersEntities,
        ONLINE,
        Relationships.BLOCKED,
      );
      const requesterId = clients[0].id;
      const requestedId = clients[1].id;
      requesterSocket = clients[0].socket;
      requestedSocket = clients[1].socket;
      await waitForExpect(() => {
        expect(activityManager.getActivity(requesterId)).not.toBeNull();
        expect(activityManager.getActivity(requestedId)).not.toBeNull();
      });
      gateway.emitUserInfo(
        requesterSocket.id,
        createUserInfoDto(requesterId, requestedId),
      );
      const { activity, gameId, relationship, userId }: UserInfoDto =
        await new Promise((resolve) =>
          requesterSocket.on('userInfo', (data) => resolve(data)),
        );
      expect(activity).toEqual('online');
      expect(gameId).toEqual(null);
      expect(['blocked', 'blocker'].includes(relationship)).toBeTruthy();
      expect(userId).toEqual(requestedId);
    });

    it('should send online & pendingSender | pendingRequester | friend', async () => {
      const clients = await createClients(
        usersEntities,
        ONLINE,
        Relationships.FRIEND,
      );
      const requesterId = clients[0].id;
      const requestedId = clients[1].id;
      requesterSocket = clients[0].socket;
      requestedSocket = clients[1].socket;
      await waitForExpect(() => {
        expect(activityManager.getActivity(requesterId)).not.toBeNull();
        expect(activityManager.getActivity(requestedId)).not.toBeNull();
      });
      gateway.emitUserInfo(
        requesterSocket.id,
        createUserInfoDto(requesterId, requestedId),
      );
      const { activity, gameId, relationship, userId }: UserInfoDto =
        await new Promise((resolve) =>
          requesterSocket.on('userInfo', (data) => resolve(data)),
        );
      expect(activity).toEqual('online');
      expect(gameId).toEqual(null);
      expect(
        ['pendingSender', 'pendingReceiver', 'friend'].includes(relationship),
      ).toBeTruthy();
      expect(userId).toEqual(requestedId);
    });

    // TODO : add tests for inGame

   /*****************************************************************************
    *                                                                           *
    * SECTION : DTO creator                                                     *
    *                                                                           *
    ****************************************************************************/

    const createUserInfoDto = (
      requesterId: UserId,
      requestedId: UserId,
    ): UserInfoDto => {
      let activity: Activity = 'offline';
      const currentUi = activityManager.getActivity(requestedId);
      if (currentUi) {
        activity = currentUi === 'playingGame' ? 'inGame' : 'online';
      }

      // TODO : 게임 중이라면 GameStorage 에서 gameId 가져오기
      const gameId = null;

      const relationship =
        userRelationshipStorage.getRelationship(requesterId, requestedId) ??
        'normal';

      return {
        activity,
        gameId,
        relationship,
        userId: requestedId,
      };
    };
  });

  /*****************************************************************************
   *                                                                           *
   * SECTION : Events for friendship                                           *
   *                                                                           *
   ****************************************************************************/
  // describe('Events for friendship', () => {
  //   let senderSocket: Socket;
  //   let receiverSocket: Socket;

  //   afterEach(() => {
  //     senderSocket.close();
  //     receiverSocket?.close();
  //   });

    // it('should send a notification to the pendingSender that the friendship request has been accepted', async () => {
    //   const clients = await createClients(
    //     usersEntities,
    //     ONLINE,
    //     Relationships.FRIEND,
    //     [44, 45],
    //   );
    //   const senderId = clients[0].id;
    //   const receiverId = clients[1].id;
    //   senderSocket = clients[0].socket;
    //   receiverSocket = clients[1].socket;

    //   await waitForExpect(() => {
    //     expect(activityManager.getActivity(senderId)).not.toBeNull();
    //     expect(activityManager.getActivity(receiverId)).not.toBeNull();
    //   });

    //   gateway.emitFriendAccepted(senderSocket, receiverId);
    // });
  });
});

/*****************************************************************************
 *                                                                           *
 * SECTION : Utils                                                           *
 *                                                                           *
 ****************************************************************************/

const connectClient = async (userId: UserId, ui = 'profile') => {
  const socket = io('http://localhost:4244', {
    extraHeaders: { 'x-user-id': userId.toString() },
  });
  await new Promise((resolve) => socket.on('connect', () => resolve('done')));
  socket.emit('currentUi', { userId, ui });
  return socket;
};

const createClients = async (
  usersEntities: Users[],
  isRequestedOnline: boolean,
  relationship: Relationships,
  indexes: [number, number] | null = null,
) => {
  const [first, second] = (() => {
    if (indexes) return indexes;
    switch (relationship) {
      case Relationships.NORMAL:
        return [
          faker.helpers.unique(faker.datatype.number, [{ min: 0, max: 39 }]),
          faker.helpers.unique(faker.datatype.number, [{ min: 0, max: 39 }]),
        ];
      case Relationships.FRIEND:
        return faker.datatype.boolean() ? [40, 41] : [43, 42];
      case Relationships.BLOCKED:
        return faker.datatype.boolean() ? [70, 71] : [73, 72];
      default:
    }
  })();
  const clientIds = [usersEntities[first].userId, usersEntities[second].userId];
  const requester = await connectClient(clientIds[0], 'profile');
  let requested: Socket;
  if (isRequestedOnline) {
    requested = await connectClient(clientIds[1], 'profile');
  }
  return [
    { id: clientIds[0], socket: requester },
    { id: clientIds[1], socket: requested ?? null },
  ];
};
