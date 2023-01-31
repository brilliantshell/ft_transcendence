import { DataSource, Repository } from 'typeorm';
import { ConflictException, NotFoundException } from '@nestjs/common';
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

    usersEntities = generateUsers(20);

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
        emitFriendRequest: (socketId: SocketId, requesterId: UserId) => {},
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
    it('should block a user (both logged in)', async () => {
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

    it('should unblock a user (both logged in)', async () => {
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

  // describe('Friend', () => {
  //   it('should send a friend requst (both logged in)', async () => {
  //     const [senderId, receiverID] = userIds;
  //     const spy = jest.spyOn(userGateway, 'emitPendingFriendRequest');
  //     expect(
  //       await service.createFriendRequest(senderId, receiverID),
  //     ).toBeTruthy();
  //     expect(
  //       userRelationshipStorage.getRelationship(senderId, receiverID),
  //     ).toEqual('pendingSender');
  //     expect(
  //       userRelationshipStorage.getRelationship(receiverID, senderId),
  //     ).toEqual('pendingReceiver');
  //     expect(spy).toHaveBeenCalledWith(
  //       userSocketStorage.clients.get(receiverID),
  //       senderId,
  //     );
  //   });
  // });
});
