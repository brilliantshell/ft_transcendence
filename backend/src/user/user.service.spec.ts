import { ConflictException, NotFoundException } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { nanoid } from 'nanoid';

import { ActivityManager } from '../user-status/activity.manager';
import { BannedMembers } from '../entity/banned-members.entity';
import { BlockedUsers } from '../entity/blocked-users.entity';
import { ChannelMembers } from '../entity/channel-members.entity';
import { ChannelStorage } from '../user-status/channel.storage';
import { Channels } from '../entity/channels.entity';
import { Friends } from '../entity/friends.entity';
import { Messages } from '../entity/messages.entity';
import {
  TYPEORM_SHARED_CONFIG,
  createDataSources,
  destroyDataSources,
} from '../../test/db-resource-manager';
import { UserGateway } from './user.gateway';
import { UserId, SocketId } from '../util/type';
import { UserInfoDto } from './dto/user-gateway.dto';
import { UserRelationshipStorage } from '../user-status/user-relationship.storage';
import { UserService } from './user.service';
import { UserSocketStorage } from '../user-status/user-socket.storage';
import { Users } from '../entity/users.entity';
import { generateUsers } from '../../test/generate-mock-data';

const TEST_DB = 'test_db_user_service';
const ENTITIES = [
  BlockedUsers,
  Channels,
  Friends,
  Users,
  ChannelMembers,
  BannedMembers,
  Messages,
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
  let activityManager: ActivityManager;
  let index = 0;

  beforeAll(async () => {
    const dataSources = await createDataSources(TEST_DB, ENTITIES);
    initDataSource = dataSources.initDataSource;
    dataSource = dataSources.dataSource;

    usersEntities = generateUsers(40);

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
        UserService,
        UserGateway,
        UserRelationshipStorage,
        UserSocketStorage,
        ActivityManager,
        ChannelStorage,
      ],
    })
      .overrideProvider(UserGateway)
      .useValue({
        emitUserInfo: (socketId: SocketId, userInfo: UserInfoDto) => {},
        emitBlocked: (socketId: SocketId, blockerId: UserId) => {},
        emitUnblocked: (socketId: SocketId, unblockerId: UserId) => {},
        emitPendingFriendRequest: (
          socketId: SocketId,
          isPending: boolean,
        ) => {},
        emitFriendCancelled: (socketId: SocketId, cancelledBy: UserId) => {},
        emitFriendRemoved: (socketId: SocketId, removedBy: UserId) => {},
        emitFriendAccepted: (socketId: SocketId, acceptedBy: UserId) => {},
        emitFriendDeclined: (socketId: SocketId, declinedBy: UserId) => {},
      })
      .compile();

    await module.init();

    service = module.get<UserService>(UserService);
    userGateway = module.get<UserGateway>(UserGateway);
    userSocketStorage = module.get<UserSocketStorage>(UserSocketStorage);
    userRelationshipStorage = module.get<UserRelationshipStorage>(
      UserRelationshipStorage,
    );
    channelStorage = module.get<ChannelStorage>(ChannelStorage);
    activityManager = module.get<ActivityManager>(ActivityManager);
    userIds = [usersEntities[index].userId, usersEntities[index + 1].userId];
    userIds.forEach((userId) => {
      const socketId = nanoid();
      userSocketStorage.clients.set(userId, socketId);
      userSocketStorage.sockets.set(socketId, userId);
      userRelationshipStorage.load(userId);
      channelStorage.loadUser(userId);
      activityManager.setActivity(userId, 'profile');
    });
  });

  afterEach(() => {
    index++;
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
          select: ['nickname', 'profileImage'],
          where: { userId: targetId },
        }),
      );
    });

    it('should throw NOT FOUND when the user does not exist', async () => {
      const [requesterId] = userIds;
      let targetId = 10000;
      while (userIds.includes(targetId)) {
        targetId++;
      }
      expect(
        async () => await service.findProfile(requesterId, targetId),
      ).rejects.toThrowError(NotFoundException);
    });

    it('should emit userInfo event', async () => {
      const spy = jest.spyOn(userGateway, 'emitUserInfo');
      const [requesterId, targetId] = userIds;
      await service.findProfile(requesterId, targetId);
      expect(spy).toHaveBeenCalled();
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

  // TODO : game 관련 비즈니스 로직 테스트
  // describe('Game', () => {});

  describe('Block', () => {
    it('should block a user (both are logged in)', async () => {
      const [blockerId, blockedId] = userIds;
      const spy = jest.spyOn(userGateway, 'emitBlocked');
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
      );
    });

    it('should block a user (only the blocker is logged in)', async () => {
      const [blockerId, blockedId] = userIds;
      userSocketStorage.clients.delete(blockedId);
      userRelationshipStorage.unload(blockedId);
      activityManager.deleteActivity(blockedId);
      const spy = jest.spyOn(userGateway, 'emitBlocked');
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
      const spy = jest.spyOn(userGateway, 'emitUnblocked');
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
      const spy = jest.spyOn(userGateway, 'emitUnblocked');
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
      const spy = jest.spyOn(userGateway, 'emitPendingFriendRequest');
      expect(
        await service.createFriendRequest(senderId, receiverId),
      ).toBeTruthy();
      expect(
        userRelationshipStorage.getRelationship(senderId, receiverId),
      ).toEqual('pendingSender');
      expect(
        userRelationshipStorage.getRelationship(receiverId, senderId),
      ).toEqual('pendingReceiver');
      expect(spy).toHaveBeenCalledWith(
        userSocketStorage.clients.get(receiverId),
        true,
      );
    });

    it('should send a friend requst (only the sender is logged in)', async () => {
      const [senderId, receiverId] = userIds;
      userSocketStorage.clients.delete(receiverId);
      userRelationshipStorage.unload(receiverId);
      activityManager.deleteActivity(receiverId);
      const spy = jest.spyOn(userGateway, 'emitPendingFriendRequest');
      expect(
        await service.createFriendRequest(senderId, receiverId),
      ).toBeTruthy();
      expect(
        userRelationshipStorage.getRelationship(senderId, receiverId),
      ).toEqual('pendingSender');
      expect(
        userRelationshipStorage.getRelationship(receiverId, senderId),
      ).toBeNull();
      expect(spy).not.toHaveBeenCalled();
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

    it('should throw CONFLICT when the sender had already received a friend request from the receiver', async () => {
      const [senderId, receiverId] = userIds;
      await service.createFriendRequest(receiverId, senderId);
      await expect(
        service.createFriendRequest(senderId, receiverId),
      ).rejects.toThrowError(ConflictException);
    });

    it('should throw CONFLICT when the sender and the receiver are already friends', async () => {
      const [senderId, receiverId] = userIds;
      await service.createFriendRequest(senderId, receiverId);
      await service.acceptFriendRequest(receiverId, senderId);
      await expect(
        service.createFriendRequest(senderId, receiverId),
      ).rejects.toThrowError(ConflictException);
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
      const spy = jest.spyOn(userGateway, 'emitFriendCancelled');
      await service.deleteFriendship(canceller, cancelled);
      expect(
        userRelationshipStorage.getRelationship(canceller, cancelled),
      ).toBeNull();
      expect(
        userRelationshipStorage.getRelationship(cancelled, canceller),
      ).toBeNull();
      expect(spy).toHaveBeenCalledWith(
        userSocketStorage.clients.get(cancelled),
        canceller,
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
      const spy = jest.spyOn(userGateway, 'emitFriendCancelled');
      await service.deleteFriendship(canceller, cancelled);
      expect(
        userRelationshipStorage.getRelationship(canceller, cancelled),
      ).toBeNull();
      expect(spy).not.toHaveBeenCalled();
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
      const spy = jest.spyOn(userGateway, 'emitFriendDeclined');
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
      const spy = jest.spyOn(userGateway, 'emitFriendDeclined');
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
      const spy = jest.spyOn(userGateway, 'emitFriendAccepted');
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
      const spy = jest.spyOn(userGateway, 'emitFriendAccepted');
      await service.acceptFriendRequest(accepter, accepted);
      expect(
        userRelationshipStorage.getRelationship(accepter, accepted),
      ).toEqual('friend');
      expect(spy).not.toHaveBeenCalled();
    });

    it('should throw CONFLICT when the accepter had sent a friend request from the accepted', async () => {
      const [accepter, accepted] = userIds;
      await service.createFriendRequest(accepter, accepted);
      await expect(
        service.acceptFriendRequest(accepter, accepted),
      ).rejects.toThrowError(ConflictException);
    });

    it('should throw CONFLICT when the accepter already is a friend with the accepted', async () => {
      const [accepter, accepted] = userIds;
      await service.createFriendRequest(accepted, accepter);
      await service.acceptFriendRequest(accepter, accepted);
      await expect(
        service.acceptFriendRequest(accepter, accepted),
      ).rejects.toThrowError(ConflictException);
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
      expect(new Set(service.findFriends(userId))).toEqual(new Set(friendIds));
    });
  });
});
