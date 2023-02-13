import { DataSource, Repository } from 'typeorm';
import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { nanoid } from 'nanoid';

import { ActivityGateway } from './../user-status/activity.gateway';
import { ActivityManager } from '../user-status/activity.manager';
import { BannedMembers } from '../entity/banned-members.entity';
import { BlockedUsers } from '../entity/blocked-users.entity';
import { ChannelMembers } from '../entity/channel-members.entity';
import { ChannelStorage } from '../user-status/channel.storage';
import { Channels } from '../entity/channels.entity';
import { ChatsGateway } from './../chats/chats.gateway';
import { Friends } from '../entity/friends.entity';
import { Messages } from '../entity/messages.entity';
import { Relationship, SocketId, UserId } from '../util/type';
import {
  TYPEORM_SHARED_CONFIG,
  createDataSources,
  destroyDataSources,
} from '../../test/db-resource-manager';
import { UserGateway } from './user.gateway';
import { UserRelationshipStorage } from '../user-status/user-relationship.storage';
import { UserService } from './user.service';
import { UserSocketStorage } from '../user-status/user-socket.storage';
import { Users } from '../entity/users.entity';
import { generateUsers } from '../../test/generate-mock-data';

const TEST_DB = 'test_db_user_service';
const ENTITIES = [
  BannedMembers,
  BlockedUsers,
  ChannelMembers,
  Channels,
  Friends,
  Messages,
  Users,
];

describe('UserService', () => {
  let service: UserService;
  let userGateway: UserGateway;
  let userIds: UserId[];
  let usersEntities: Users[];
  let initDataSource: DataSource;
  let dataSource: DataSource;
  let usersRepository: Repository<Users>;
  let userSocketStorage: UserSocketStorage;
  let channelStorage: ChannelStorage;
  let userRelationshipStorage: UserRelationshipStorage;
  let activityGateway: ActivityGateway;
  let activityManager: ActivityManager;
  let index = 0;

  beforeAll(async () => {
    const dataSources = await createDataSources(TEST_DB, ENTITIES);
    initDataSource = dataSources.initDataSource;
    dataSource = dataSources.dataSource;
    usersEntities = generateUsers(50);
    usersRepository = dataSource.getRepository(Users);
    await usersRepository.save(usersEntities);
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'postgres',
          ...TYPEORM_SHARED_CONFIG,
          autoLoadEntities: true,
          database: TEST_DB,
        }),
        TypeOrmModule.forFeature(ENTITIES),
      ],
      providers: [
        ActivityGateway,
        ActivityManager,
        ChannelStorage,
        ChatsGateway,
        UserGateway,
        UserRelationshipStorage,
        UserService,
        UserSocketStorage,
      ],
    })
      .overrideProvider(UserGateway)
      .useValue({
        emitUserRelationship: (
          socketId: SocketId,
          userId: UserId,
          relationship: Relationship | 'normal',
        ) => undefined,
        emitFriendRequestDiff: (socketId: SocketId, requestDiff: 1 | -1) =>
          undefined,
      })
      .overrideProvider(ActivityGateway)
      .useValue({ emitUserActivity: (targetId: UserId) => undefined })
      .compile();

    await module.init();

    service = module.get<UserService>(UserService);
    userGateway = module.get<UserGateway>(UserGateway);
    userSocketStorage = module.get<UserSocketStorage>(UserSocketStorage);
    userRelationshipStorage = module.get<UserRelationshipStorage>(
      UserRelationshipStorage,
    );
    channelStorage = module.get<ChannelStorage>(ChannelStorage);
    activityGateway = module.get<ActivityGateway>(ActivityGateway);
    activityManager = module.get<ActivityManager>(ActivityManager);
    userIds = [usersEntities[index++].userId, usersEntities[index++].userId];
    userIds.forEach((userId) => {
      const socketId = nanoid();
      userSocketStorage.clients.set(userId, socketId);
      userSocketStorage.sockets.set(socketId, userId);
      userRelationshipStorage.load(userId);
      channelStorage.loadUser(userId);
      activityManager.setActivity(userId, 'profile');
    });
  });

  afterAll(async () => {
    await destroyDataSources(TEST_DB, dataSource, initDataSource);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('nickname and profileImage', () => {
    it("should return the existing user's nickname and profile image path", async () => {
      const [requesterId, targetId] = userIds;
      expect(await service.findProfile(requesterId, targetId)).toEqual(
        await usersRepository.findOne({
          select: ['nickname', 'isDefaultImage'],
          where: { userId: targetId },
        }),
      );
    });

    it('should emit userActivity and userRelationship event', async () => {
      const spies = [
        jest.spyOn(userGateway, 'emitUserRelationship'),
        jest.spyOn(activityGateway, 'emitUserActivity'),
      ];
      const [requesterId, targetId] = userIds;
      await service.findProfile(requesterId, targetId);
      expect(spies[0]).toHaveBeenCalled();
      expect(spies[1]).toHaveBeenCalled();
    });
  });

  describe('DM', () => {
    it('should create a new DM channel if not exists', async () => {
      const [ownerId, peerId] = userIds;
      const result = await service.createDm(ownerId, peerId);
      expect(result).toBeDefined();
      expect(channelStorage.getChannel(result.dmId)).toBeDefined();
      expect(result.isNew).toBeTruthy();
    });

    it('should return the existing DM channel if exists', async () => {
      const [ownerId, peerId] = userIds;
      const newDm = await service.createDm(ownerId, peerId);
      const existing = await service.createDm(ownerId, peerId);
      expect(newDm).toBeDefined();
      expect(existing).toBeDefined();
      expect(newDm.dmId).toEqual(existing.dmId);
      expect(newDm.isNew).toBeTruthy();
      expect(existing.isNew).toBeFalsy();
    });
  });

  /*****************************************************************************
   *                                                                           *
   *   TODO : game 관련 비즈니스 로직 테스트                                         *
   *                                                                           *
   ****************************************************************************/
  // describe('Game', () => {});

  describe('Block', () => {
    it('should block a user (both are logged in)', async () => {
      const [blockerId, blockedId] = userIds;
      const spy = jest.spyOn(userGateway, 'emitUserRelationship');
      expect(await service.createBlock(blockerId, blockedId)).toBeTruthy();
      expect(
        userRelationshipStorage.getRelationship(blockerId, blockedId),
      ).toEqual('blocker');
      expect(
        userRelationshipStorage.getRelationship(blockedId, blockerId),
      ).toEqual('blocked');
      expect(spy).toHaveBeenCalledWith(
        userSocketStorage.clients.get(blockedId),
        blockerId,
        'blocked',
      );
    });

    it('should block a user (only the blocker is logged in)', async () => {
      const [blockerId, blockedId] = userIds;
      userSocketStorage.clients.delete(blockedId);
      userRelationshipStorage.unload(blockedId);
      activityManager.deleteActivity(blockedId);
      const spy = jest.spyOn(userGateway, 'emitUserRelationship');
      expect(await service.createBlock(blockerId, blockedId)).toBeTruthy();
      expect(
        userRelationshipStorage.getRelationship(blockerId, blockedId),
      ).toEqual('blocker');
      expect(userRelationshipStorage.getRelationship(blockedId, blockerId))
        .toBeUndefined;
      expect(spy).not.toHaveBeenCalled();
    });

    it('should return false when the block relationship has been already there', async () => {
      const [blockerId, blockedId] = userIds;
      expect(await service.createBlock(blockerId, blockedId)).toBeTruthy();
      expect(await service.createBlock(blockerId, blockedId)).toBeFalsy();
    });

    it('should unblock a user (both are logged in)', async () => {
      const [unblockerId, unblockedId] = userIds;
      await service.createBlock(unblockerId, unblockedId);
      expect(
        userRelationshipStorage.getRelationship(unblockerId, unblockedId),
      ).toEqual('blocker');
      const spy = jest.spyOn(userGateway, 'emitUserRelationship');
      await service.deleteBlock(unblockerId, unblockedId);
      expect(
        userRelationshipStorage.getRelationship(unblockerId, unblockedId),
      ).toBeNull();
      expect(
        userRelationshipStorage.getRelationship(unblockedId, unblockerId),
      ).toBeNull();
      expect(spy).toHaveBeenCalledWith(
        userSocketStorage.clients.get(unblockedId),
        unblockerId,
        'normal',
      );
    });

    it('should unblock a user (only the unblocker is logged in)', async () => {
      const [unblockerId, unblockedId] = userIds;
      userSocketStorage.clients.delete(unblockedId);
      userRelationshipStorage.unload(unblockedId);
      activityManager.deleteActivity(unblockedId);
      await service.createBlock(unblockerId, unblockedId);
      expect(
        userRelationshipStorage.getRelationship(unblockerId, unblockedId),
      ).toEqual('blocker');
      const spy = jest.spyOn(userGateway, 'emitUserRelationship');
      await service.deleteBlock(unblockerId, unblockedId);
      expect(
        userRelationshipStorage.getRelationship(unblockerId, unblockedId),
      ).toBeNull();
      expect(spy).not.toHaveBeenCalled();
    });
  });

  describe('Friend', () => {
    it('should send a friend requst (both are logged in)', async () => {
      const [senderId, receiverId] = userIds;
      const spies = [
        jest.spyOn(userGateway, 'emitUserRelationship'),
        jest.spyOn(userGateway, 'emitFriendRequestDiff'),
      ];
      expect(
        await service.createFriendRequest(senderId, receiverId),
      ).toBeTruthy();
      expect(
        userRelationshipStorage.getRelationship(senderId, receiverId),
      ).toEqual('pendingSender');
      expect(
        userRelationshipStorage.getRelationship(receiverId, senderId),
      ).toEqual('pendingReceiver');
      expect(spies[0]).toHaveBeenCalledWith(
        userSocketStorage.clients.get(receiverId),
        senderId,
        'pendingReceiver',
      );
      expect(spies[1]).toHaveBeenCalledWith(
        userSocketStorage.clients.get(receiverId),
        1,
      );
    });

    it('should send a friend requst (only the sender is logged in)', async () => {
      const [senderId, receiverId] = userIds;
      userSocketStorage.clients.delete(receiverId);
      userRelationshipStorage.unload(receiverId);
      activityManager.deleteActivity(receiverId);
      const spies = [
        jest.spyOn(userGateway, 'emitUserRelationship'),
        jest.spyOn(userGateway, 'emitFriendRequestDiff'),
      ];
      expect(
        await service.createFriendRequest(senderId, receiverId),
      ).toBeTruthy();
      expect(
        userRelationshipStorage.getRelationship(senderId, receiverId),
      ).toEqual('pendingSender');
      expect(
        userRelationshipStorage.getRelationship(receiverId, senderId),
      ).toBeNull();
      expect(spies[0]).not.toHaveBeenCalled();
      expect(spies[1]).not.toHaveBeenCalled();
    });

    it('should return false when the friend request has been already there', async () => {
      const [senderId, receiverId] = userIds;
      expect(
        await service.createFriendRequest(senderId, receiverId),
      ).toBeTruthy();
      expect(
        await service.createFriendRequest(senderId, receiverId),
      ).toBeFalsy();
    });

    it('should cancel a friend request (both are logged in)', async () => {
      const [canceller, cancelled] = userIds;
      await service.createFriendRequest(canceller, cancelled);
      expect(
        userRelationshipStorage.getRelationship(canceller, cancelled),
      ).toEqual('pendingSender');
      expect(
        userRelationshipStorage.getRelationship(cancelled, canceller),
      ).toEqual('pendingReceiver');
      const spies = [
        jest.spyOn(userGateway, 'emitUserRelationship'),
        jest.spyOn(userGateway, 'emitFriendRequestDiff'),
      ];
      await service.deleteFriendship(canceller, cancelled);
      expect(
        userRelationshipStorage.getRelationship(canceller, cancelled),
      ).toBeNull();
      expect(
        userRelationshipStorage.getRelationship(cancelled, canceller),
      ).toBeNull();
      expect(spies[0]).toHaveBeenCalledWith(
        userSocketStorage.clients.get(cancelled),
        canceller,
        'normal',
      );
      expect(spies[1]).toHaveBeenCalledWith(
        userSocketStorage.clients.get(cancelled),
        -1,
      );
    });

    it('should cancel a friend request (only the canceller is logged in)', async () => {
      const [canceller, cancelled] = userIds;
      userSocketStorage.clients.delete(cancelled);
      userRelationshipStorage.unload(cancelled);
      activityManager.deleteActivity(cancelled);
      await service.createFriendRequest(canceller, cancelled);
      expect(
        userRelationshipStorage.getRelationship(canceller, cancelled),
      ).toEqual('pendingSender');
      const spies = [
        jest.spyOn(userGateway, 'emitUserRelationship'),
        jest.spyOn(userGateway, 'emitFriendRequestDiff'),
      ];
      await service.deleteFriendship(canceller, cancelled);
      expect(
        userRelationshipStorage.getRelationship(canceller, cancelled),
      ).toBeNull();
      expect(spies[0]).not.toHaveBeenCalled();
      expect(spies[1]).not.toHaveBeenCalled();
    });

    it('should decline a friend request (both are logged in)', async () => {
      const [decliner, declined] = userIds;
      await service.createFriendRequest(declined, decliner);
      expect(
        userRelationshipStorage.getRelationship(decliner, declined),
      ).toEqual('pendingReceiver');
      expect(
        userRelationshipStorage.getRelationship(declined, decliner),
      ).toEqual('pendingSender');
      const spy = jest.spyOn(userGateway, 'emitUserRelationship');
      await service.deleteFriendship(decliner, declined);
      expect(
        userRelationshipStorage.getRelationship(declined, decliner),
      ).toBeNull();
      expect(
        userRelationshipStorage.getRelationship(decliner, declined),
      ).toBeNull();
      expect(spy).toHaveBeenCalledWith(
        userSocketStorage.clients.get(declined),
        decliner,
        'normal',
      );
    });

    it('should decline a friend request (only the decliner is logged in)', async () => {
      const [decliner, declined] = userIds;
      await service.createFriendRequest(declined, decliner);
      userSocketStorage.clients.delete(declined);
      userRelationshipStorage.unload(declined);
      activityManager.deleteActivity(declined);
      expect(
        userRelationshipStorage.getRelationship(decliner, declined),
      ).toEqual('pendingReceiver');
      const spy = jest.spyOn(userGateway, 'emitUserRelationship');
      await service.deleteFriendship(decliner, declined);
      expect(
        userRelationshipStorage.getRelationship(declined, decliner),
      ).toBeNull();
      expect(spy).not.toHaveBeenCalled();
    });

    it('should accept a friend request (both are logged in)', async () => {
      const [accepter, accepted] = userIds;
      await service.createFriendRequest(accepted, accepter);
      expect(
        userRelationshipStorage.getRelationship(accepter, accepted),
      ).toEqual('pendingReceiver');
      expect(
        userRelationshipStorage.getRelationship(accepted, accepter),
      ).toEqual('pendingSender');
      const spy = jest.spyOn(userGateway, 'emitUserRelationship');
      await service.acceptFriendRequest(accepter, accepted);
      expect(
        userRelationshipStorage.getRelationship(accepted, accepter),
      ).toEqual('friend');
      expect(
        userRelationshipStorage.getRelationship(accepter, accepted),
      ).toEqual('friend');
      expect(spy).toHaveBeenCalledWith(
        userSocketStorage.clients.get(accepted),
        accepter,
        'friend',
      );
    });

    it('should accept a friend request (only the accepter is logged in)', async () => {
      const [accepter, accepted] = userIds;
      await service.createFriendRequest(accepted, accepter);
      userSocketStorage.clients.delete(accepted);
      userRelationshipStorage.unload(accepted);
      activityManager.deleteActivity(accepted);
      expect(
        userRelationshipStorage.getRelationship(accepter, accepted),
      ).toEqual('pendingReceiver');
      const spy = jest.spyOn(userGateway, 'emitUserRelationship');
      await service.acceptFriendRequest(accepter, accepted);
      expect(
        userRelationshipStorage.getRelationship(accepter, accepted),
      ).toEqual('friend');
      expect(spy).not.toHaveBeenCalled();
    });

    it('should remove friendship (both are logged in)', async () => {
      const [remover, removed] = userIds;
      await service.createFriendRequest(remover, removed);
      expect(userRelationshipStorage.getRelationship(remover, removed)).toEqual(
        'pendingSender',
      );
      expect(userRelationshipStorage.getRelationship(removed, remover)).toEqual(
        'pendingReceiver',
      );
      await service.acceptFriendRequest(remover, removed);
      expect(userRelationshipStorage.getRelationship(removed, remover)).toEqual(
        'friend',
      );
      expect(userRelationshipStorage.getRelationship(remover, removed)).toEqual(
        'friend',
      );
      const spy = jest.spyOn(userGateway, 'emitUserRelationship');
      await service.deleteFriendship(remover, removed);
      expect(
        userRelationshipStorage.getRelationship(remover, remover),
      ).toBeNull();
      expect(
        userRelationshipStorage.getRelationship(removed, remover),
      ).toBeNull();
      expect(spy).toHaveBeenCalledWith(
        userSocketStorage.clients.get(removed),
        remover,
        'normal',
      );
    });

    it('should remove friendship (only the remover is logged in)', async () => {
      const [removed, remover] = userIds;
      await service.createFriendRequest(removed, remover);
      userSocketStorage.clients.delete(removed);
      userRelationshipStorage.unload(removed);
      activityManager.deleteActivity(removed);
      expect(userRelationshipStorage.getRelationship(remover, removed)).toEqual(
        'pendingReceiver',
      );
      await service.acceptFriendRequest(remover, removed);
      expect(userRelationshipStorage.getRelationship(remover, removed)).toEqual(
        'friend',
      );
      const spy = jest.spyOn(userGateway, 'emitUserRelationship');
      await service.deleteFriendship(remover, removed);
      expect(
        userRelationshipStorage.getRelationship(remover, remover),
      ).toBeNull();

      expect(spy).not.toHaveBeenCalled();
    });

    it("should return a list of friends's ids", async () => {
      const friends = generateUsers(10);
      await usersRepository.save(friends);
      const { userId } = friends[9];
      for (const friend of friends) {
        const socketId = nanoid();
        userSocketStorage.clients.set(friend.userId, socketId);
        userSocketStorage.sockets.set(socketId, friend.userId);
        userRelationshipStorage.load(friend.userId);
        channelStorage.loadUser(friend.userId);
        activityManager.setActivity(friend.userId, 'profile');
      }
      friends.pop();
      const friendIds = [];
      await Promise.all(
        friends.map((friend) => {
          friendIds.push(friend.userId);
          return service.createFriendRequest(userId, friend.userId);
        }),
      );
      expect(new Set(service.findFriends(userId).friends)).toEqual(
        new Set(friendIds),
      );
    });
  });
});
