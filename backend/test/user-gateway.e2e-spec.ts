import { INestApplication } from '@nestjs/common';
import { Socket, io } from 'socket.io-client';
import { Test, TestingModule } from '@nestjs/testing';
import { faker } from '@faker-js/faker';
import { getRepositoryToken } from '@nestjs/typeorm';
import waitForExpect from 'wait-for-expect';

import { Activity, UserId } from '../src/util/type';
import { ActivityManager } from '../src/user-status/activity.manager';
import { AppModule } from '../src/app.module';
import {
  BlockedDto,
  FriendCancelledDto,
  FriendDeclinedDto,
  FriendRemovedDto,
  PendingFriendRequestDto,
  UnblockedDto,
} from '../src/user/dto/user-gateway.dto';
import { BlockedUsers } from '../src/entity/blocked-users.entity';
import {
  FriendAcceptedDto,
  UserInfoDto,
} from '../src/user/dto/user-gateway.dto';
import { Friends } from '../src/entity/friends.entity';
import { UserGateway } from '../src/user/user.gateway';
import { UserRelationshipStorage } from '../src/user-status/user-relationship.storage';
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

    //  NOTE : UserService 구현 하면서 UserService 내부 로직으로 들어갈 코드
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
  describe('Events for friendship', () => {
    let senderId: UserId;
    let receiverId: UserId;
    let senderSocket: Socket;
    let receiverSocket: Socket;

    beforeEach(async () => {
      const clients = await createClients(usersEntities, ONLINE);
      senderId = clients[0].id;
      receiverId = clients[1].id;
      senderSocket = clients[0].socket;
      receiverSocket = clients[1].socket;
    });

    afterEach(() => {
      senderSocket.close();
      receiverSocket?.close();
    });

    it('should let the sender know that the friendship request has been accepted', async () => {
      gateway.emitFriendAccepted(senderSocket.id, receiverId);
      const { newFriendId } = await new Promise<FriendAcceptedDto>((resolve) =>
        senderSocket.on('friendAccepted', (data: FriendAcceptedDto) =>
          resolve(data),
        ),
      );
      expect(newFriendId).toEqual(receiverId);
    });

    it('should let the sender know that the friendship request has been declined', async () => {
      gateway.emitFriendDeclined(senderSocket.id, receiverId);
      const { declinedBy } = await new Promise<FriendDeclinedDto>((resolve) =>
        senderSocket.on('friendDeclined', (data: FriendDeclinedDto) =>
          resolve(data),
        ),
      );
      expect(declinedBy).toEqual(receiverId);
    });

    it('should let the receiver know that the friend request has been cancelled by the sender', async () => {
      gateway.emitFriendCancelled(receiverSocket.id, senderId);
      const { cancelledBy } = await new Promise<FriendCancelledDto>((resolve) =>
        receiverSocket.on('friendCancelled', (data: FriendCancelledDto) =>
          resolve(data),
        ),
      );
      expect(cancelledBy).toEqual(senderId);
    });

    it('should notifiy a user when there is a new friend request', async () => {
      gateway.emitPendingFriendRequest(receiverSocket.id, true);
      const { isPending } = await new Promise<PendingFriendRequestDto>(
        (resolve) => {
          receiverSocket.on(
            'pendingFriendRequest',
            (data: PendingFriendRequestDto) => resolve(data),
          );
        },
      );
      expect(isPending).toBeTruthy();
    });

    it('should let the user know that he is no longer friend to another user', async () => {
      gateway.emitFriendRemoved(senderSocket.id, receiverId);
      const { removedBy } = await new Promise<FriendRemovedDto>((resolve) =>
        senderSocket.on('friendRemoved', (data: FriendRemovedDto) =>
          resolve(data),
        ),
      );
      expect(removedBy).toEqual(receiverId);
    });
  });

  /*****************************************************************************
   *                                                                           *
   * SECTION : Events for block                                                *
   *                                                                           *
   ****************************************************************************/
  describe('Events for block', () => {
    let blockerId: UserId;
    let blockerSocket: Socket;
    let blockedSocket: Socket;

    beforeEach(async () => {
      const clients = await createClients(usersEntities, ONLINE);
      blockerId = clients[0].id;
      blockerSocket = clients[0].socket;
      blockedSocket = clients[1].socket;
    });

    afterEach(() => {
      blockerSocket.close();
      blockedSocket?.close();
    });

    it('should let the blocked user know that he is blocked by another user', async () => {
      gateway.emitBlocked(blockedSocket.id, blockerId);
      const { blockedBy } = await new Promise<BlockedDto>((resolve) =>
        blockedSocket.on('blocked', (data: BlockedDto) => resolve(data)),
      );
      expect(blockedBy).toEqual(blockerId);
    });

    it('should let the user know that he is unblocked by another user', async () => {
      gateway.emitUnblocked(blockedSocket.id, blockerId);
      const { unblockedBy } = await new Promise<UnblockedDto>((resolve) =>
        blockedSocket.on('unblocked', (data: UnblockedDto) => resolve(data)),
      );
      expect(unblockedBy).toEqual(blockerId);
    });
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
  relationship: Relationships | null = null,
) => {
  const [first, second] =
    relationship !== null
      ? chooseUsersIndices(relationship)
      : [
          faker.helpers.unique(faker.datatype.number, [{ min: 0, max: 99 }]),
          faker.helpers.unique(faker.datatype.number, [{ min: 0, max: 99 }]),
        ];
  const clientIds = [usersEntities[first].userId, usersEntities[second].userId];
  const requester = await connectClient(clientIds[0]);
  let requested: Socket;
  if (isRequestedOnline) {
    requested = await connectClient(clientIds[1]);
  }
  return [
    { id: clientIds[0], socket: requester },
    { id: clientIds[1], socket: requested ?? null },
  ];
};

const chooseUsersIndices = (relationship: Relationships) => {
  {
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
  }
};
