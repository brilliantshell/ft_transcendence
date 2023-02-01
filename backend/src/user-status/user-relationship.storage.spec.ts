import { BadRequestException, NotFoundException } from '@nestjs/common';
import { DataSource, IsNull, Not, Repository } from 'typeorm';
import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';

import {
  BlockedUsers,
  BlockedUsersInterface,
} from '../entity/blocked-users.entity';
import { Channels } from '../entity/channels.entity';
import { Friends } from '../entity/friends.entity';
import { Relationship, UserId } from '../util/type';
import {
  TYPEORM_SHARED_CONFIG,
  createDataSources,
  destroyDataSources,
} from '../../test/db-resource-manager';
import { UserRelationshipStorage } from './user-relationship.storage';
import { Users } from '../entity/users.entity';
import {
  generateBlockedUsers,
  generateChannels,
  generateFriends,
  generateUsers,
} from '../../test/generate-mock-data';

const TEST_DB = 'test_db_user_relationship';
const ENTITIES = [BlockedUsers, Friends, Users, Channels];

describe('UserRelationshipService', () => {
  let userRelationshipStorage: UserRelationshipStorage;
  let initDataSource: DataSource;
  let dataSource: DataSource;
  let target: UserId;
  let usersPool: Users[][];
  let friendEntities: Friends[];
  let blockEntities: BlockedUsersInterface[];
  let channelEntities: Channels[];
  let usersRepository: Repository<Users>;
  let friendsRepository: Repository<Friends>;
  let blockedUsersRepository: Repository<BlockedUsers>;
  let channelRepository: Repository<Channels>;

  beforeAll(async () => {
    const dataSources = await createDataSources(TEST_DB, ENTITIES);
    initDataSource = dataSources.initDataSource;
    dataSource = dataSources.dataSource;
    usersPool = [
      generateUsers(200),
      generateUsers(200),
      generateUsers(25),
      generateUsers(100),
    ];
    friendEntities = generateFriends(usersPool[0]);
    blockEntities = generateBlockedUsers(usersPool[1]);
    channelEntities = generateChannels(usersPool[3]);

    usersRepository = dataSource.getRepository(Users);
    friendsRepository = dataSource.getRepository(Friends);
    blockedUsersRepository = dataSource.getRepository(BlockedUsers);
    channelRepository = dataSource.getRepository(Channels);

    await usersRepository.save(usersPool.flat());
    await friendsRepository.save(friendEntities);
    await blockedUsersRepository.save(blockEntities);
    await channelRepository.save(channelEntities);
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
      providers: [UserRelationshipStorage],
    }).compile();

    userRelationshipStorage = module.get<UserRelationshipStorage>(
      UserRelationshipStorage,
    );
    await module.init();
    const users = await usersRepository.find({ select: { userId: true } });
    target = users[Math.floor(Math.random() * users.length)].userId;
  });

  afterAll(
    async () => await destroyDataSources(TEST_DB, dataSource, initDataSource),
  );

  it('should be defined', () => {
    expect(userRelationshipStorage).toBeDefined();
  });

  it('should save DM data at init', async () => {
    const dms = await channelRepository.find({
      select: { channelId: true, ownerId: true, dmPeerId: true },
      where: { dmPeerId: Not(IsNull()) },
    });

    dms.forEach(({ channelId, ownerId, dmPeerId }) => {
      expect(userRelationshipStorage.isBlockedDm(channelId)).toBe(
        blockEntities.includes({
          blockerId: ownerId,
          blockedId: dmPeerId,
        }) ||
          blockEntities.includes({
            blockerId: dmPeerId,
            blockedId: ownerId,
          }),
      );
    });
  });

  it('should load relationships of a user', async () => {
    await userRelationshipStorage.load(target);
    const relationshipMap: Map<UserId, Relationship> =
      userRelationshipStorage.getRelationshipMap(target);
    expect(relationshipMap).toBeDefined();
    for (const [key, value] of relationshipMap) {
      if (target === key) {
        return;
      }
      if (['friend', 'pendingSender', 'pendingReceiver'].includes(value)) {
        const friendship = await friendsRepository.findBy([
          { senderId: target, receiverId: key },
          { senderId: key, receiverId: target },
        ]);
        expect(friendship.length).toBe(1);
        const [friends] = friendship;
        if (value === 'friend') {
          return expect(friends.isAccepted).toBe(true);
        }
        expect(friends.isAccepted).toBe(false);
        return expect(
          value === 'pendingSender' ? friends.senderId : friends.receiverId,
        ).toBe(target);
      }

      const blockRelationship = await blockedUsersRepository.findBy([
        { blockerId: target, blockedId: key },
        { blockerId: key, blockedId: target },
      ]);
      expect(blockRelationship.length).toBe(1);
      expect(blockRelationship[0].blockerId).toBe(
        value === 'blocker' ? target : key,
      );
    }
  });

  it('should unload relationships of a user as the user becomes offline', async () => {
    await userRelationshipStorage.load(target);
    userRelationshipStorage.unload(target);
    expect(userRelationshipStorage.getRelationshipMap(target)).toBeUndefined();
  });

  it('should throw error when delete on nonexistent friendship was attempted', async () => {
    const [userOne, userTwo] = [usersPool[3][0].userId, usersPool[3][1].userId];
    await userRelationshipStorage.load(userOne);
    const previousSize =
      userRelationshipStorage.getRelationshipMap(userOne).size;

    expect(async () => {
      await userRelationshipStorage.deleteFriendship(userOne, userTwo);
    }).rejects.toThrowError();
    expect(userRelationshipStorage.getRelationshipMap(userOne).size).toBe(
      previousSize,
    );
  });

  it('should add a pending friendship (both loaded)', async () => {
    const [sender, receiver] = [usersPool[3][0].userId, usersPool[3][1].userId];
    await userRelationshipStorage.load(sender);
    await userRelationshipStorage.load(receiver);

    await userRelationshipStorage.sendFriendRequest(sender, receiver);
    expect(userRelationshipStorage.getRelationship(sender, receiver)).toBe(
      'pendingSender',
    );
    expect(userRelationshipStorage.getRelationship(receiver, sender)).toBe(
      'pendingReceiver',
    );

    const newPendingFriendship = await friendsRepository.findBy({
      senderId: sender,
      receiverId: receiver,
    });
    expect(newPendingFriendship.length).toEqual(1);
    expect(newPendingFriendship[0].isAccepted).toEqual(false);

    const senderRelationshipCount =
      userRelationshipStorage.getRelationshipMap(sender).size;
    const receiverRelationshipCount =
      userRelationshipStorage.getRelationshipMap(receiver).size;
    await userRelationshipStorage.deleteFriendship(sender, receiver);
    expect(userRelationshipStorage.getRelationshipMap(sender).size).toBe(
      senderRelationshipCount - 1,
    );
    expect(userRelationshipStorage.getRelationshipMap(receiver).size).toBe(
      receiverRelationshipCount - 1,
    );
    expect(
      (await friendsRepository.findBy(newPendingFriendship[0])).length,
    ).toBe(0);
  });

  it('should add a pending friendship (only sender is loaded)', async () => {
    const [sender, receiver] = [usersPool[3][0].userId, usersPool[3][1].userId];
    await userRelationshipStorage.load(sender);

    await userRelationshipStorage.sendFriendRequest(sender, receiver);
    expect(userRelationshipStorage.getRelationship(sender, receiver)).toBe(
      'pendingSender',
    );
    expect(
      userRelationshipStorage.getRelationship(receiver, sender),
    ).toBeNull();

    const newPendingFriendship = await friendsRepository.findBy({
      senderId: sender,
      receiverId: receiver,
    });
    expect(newPendingFriendship.length).toEqual(1);
    expect(newPendingFriendship[0].isAccepted).toEqual(false);

    await userRelationshipStorage.load(receiver);
    expect(userRelationshipStorage.getRelationship(receiver, sender)).toBe(
      'pendingReceiver',
    );

    const senderRelationshipCount =
      userRelationshipStorage.getRelationshipMap(sender).size;
    const receiverRelationshipCount =
      userRelationshipStorage.getRelationshipMap(receiver).size;
    await userRelationshipStorage.deleteFriendship(sender, receiver);
    expect(userRelationshipStorage.getRelationshipMap(sender).size).toBe(
      senderRelationshipCount - 1,
    );
    expect(userRelationshipStorage.getRelationshipMap(receiver).size).toBe(
      receiverRelationshipCount - 1,
    );
    expect(
      (await friendsRepository.findBy(newPendingFriendship[0])).length,
    ).toBe(0);
  });

  it('should accept a friend request (both loaded & receiver accepts)', async () => {
    const { senderId, receiverId } = friendEntities.find(
      ({ isAccepted }) => isAccepted === false,
    );
    await userRelationshipStorage.load(senderId);
    await userRelationshipStorage.load(receiverId);
    await userRelationshipStorage.acceptFriendRequest(receiverId, senderId);

    expect(userRelationshipStorage.getRelationship(receiverId, senderId)).toBe(
      'friend',
    );
    expect(userRelationshipStorage.getRelationship(senderId, receiverId)).toBe(
      'friend',
    );

    expect(
      (
        await friendsRepository.findBy({
          senderId,
          receiverId,
          isAccepted: true,
        })
      ).length,
    ).toBe(1);
  });

  it('should accept a friend request (only receiver is loaded & receiver accepts)', async () => {
    const { senderId, receiverId } = friendEntities.find(
      ({ isAccepted }) => isAccepted === false,
    );
    await userRelationshipStorage.load(receiverId);
    await userRelationshipStorage.acceptFriendRequest(receiverId, senderId);

    expect(userRelationshipStorage.getRelationship(receiverId, senderId)).toBe(
      'friend',
    );
    expect(
      userRelationshipStorage.getRelationship(senderId, receiverId),
    ).toBeNull();

    expect(
      (
        await friendsRepository.findBy({
          senderId,
          receiverId,
          isAccepted: true,
        })
      ).length,
    ).toBe(1);
  });

  it('should throw error when a sender tries to accept his own request (sender loaded)', async () => {
    const { senderId, receiverId } = (
      await friendsRepository.findBy({
        isAccepted: false,
      })
    )[0];
    await userRelationshipStorage.load(senderId);
    expect(
      async () =>
        await userRelationshipStorage.acceptFriendRequest(senderId, receiverId),
    ).rejects.toThrowError(NotFoundException);

    expect(
      userRelationshipStorage.getRelationship(receiverId, senderId),
    ).toBeNull();
    expect(userRelationshipStorage.getRelationship(senderId, receiverId)).toBe(
      'pendingSender',
    );

    expect(
      (
        await friendsRepository.findBy({
          senderId,
          receiverId,
          isAccepted: false,
        })
      ).length,
    ).toBe(1);
  });

  it('should block a user (both loaded)', async () => {
    const { channelId, ownerId, dmPeerId } = channelEntities.find(
      ({ dmPeerId }) => dmPeerId !== null,
    );
    await userRelationshipStorage.load(ownerId);
    await userRelationshipStorage.load(dmPeerId);
    await userRelationshipStorage.blockUser(ownerId, dmPeerId);
    expect(userRelationshipStorage.getRelationship(ownerId, dmPeerId)).toBe(
      'blocker',
    );
    expect(userRelationshipStorage.getRelationship(dmPeerId, ownerId)).toBe(
      'blocked',
    );
    expect(userRelationshipStorage.isBlockedDm(channelId)).toBeTruthy();

    expect(
      (
        await blockedUsersRepository.findBy({
          blockerId: ownerId,
          blockedId: dmPeerId,
        })
      ).length,
    ).toBe(1);

    await userRelationshipStorage.unblockUser(ownerId, dmPeerId);
    expect(
      userRelationshipStorage.getRelationship(ownerId, dmPeerId),
    ).toBeNull();
    expect(
      userRelationshipStorage.getRelationship(dmPeerId, ownerId),
    ).toBeNull();
    expect(
      (
        await blockedUsersRepository.findBy({
          blockerId: ownerId,
          blockedId: dmPeerId,
        })
      ).length,
    ).toBe(0);

    expect(userRelationshipStorage.isBlockedDm(channelId)).toBeFalsy();
  });

  it('should block a user (only blocker is loaded)', async () => {
    const [blockerId, blockedId] = [
      usersPool[3][0].userId,
      usersPool[3][1].userId,
    ];
    await userRelationshipStorage.load(blockerId);
    await userRelationshipStorage.blockUser(blockerId, blockedId);
    expect(userRelationshipStorage.getRelationship(blockerId, blockedId)).toBe(
      'blocker',
    );
    expect(
      userRelationshipStorage.getRelationship(blockedId, blockerId),
    ).toBeNull();

    expect(
      (
        await blockedUsersRepository.findBy({
          blockerId: blockerId,
          blockedId: blockedId,
        })
      ).length,
    ).toBe(1);

    await userRelationshipStorage.unblockUser(blockerId, blockedId);
    expect(
      userRelationshipStorage.getRelationship(blockerId, blockedId),
    ).toBeNull();
    expect(
      (
        await blockedUsersRepository.findBy({
          blockerId: blockerId,
          blockedId: blockedId,
        })
      ).length,
    ).toBe(0);
  });

  it('should block a friend and make sure they are no longer friends', async () => {
    const { senderId, receiverId } = friendEntities[0];
    const blockerId = receiverId;
    const blockedId = senderId;

    await userRelationshipStorage.load(blockerId);

    await userRelationshipStorage.blockUser(blockerId, blockedId);
    expect(userRelationshipStorage.getRelationship(blockerId, blockedId)).toBe(
      'blocker',
    );
    expect(
      userRelationshipStorage.getRelationship(blockedId, blockerId),
    ).toBeNull();

    expect(
      (await friendsRepository.findBy({ senderId, receiverId })).length,
    ).toBe(0);
    await userRelationshipStorage.unblockUser(blockerId, blockedId);
    expect(
      userRelationshipStorage.getRelationship(blockerId, blockedId),
    ).toBeNull();
    expect(
      (
        await blockedUsersRepository.findBy({
          blockerId: blockerId,
          blockedId: blockedId,
        })
      ).length,
    ).toBe(0);
  });

  // NOTE : service 에서 throw
  it.skip('should throw error when a user who is not a blocker tries to unblock', async () => {
    const { blockerId, blockedId } = blockEntities[0];
    await userRelationshipStorage.load(blockedId);
    expect(
      async () =>
        await userRelationshipStorage.unblockUser(blockedId, blockerId),
    ).rejects.toThrowError(BadRequestException);
  });

  it('should throw error when a blocked user tries to set friendship', async () => {
    const { blockerId, blockedId } = blockEntities[0];
    await userRelationshipStorage.load(blockerId);
    await userRelationshipStorage.load(blockedId);
    expect(
      async () =>
        await userRelationshipStorage.sendFriendRequest(blockerId, blockedId),
    ).rejects.toThrowError(BadRequestException);
    expect(
      async () =>
        await userRelationshipStorage.acceptFriendRequest(blockedId, blockerId),
    ).rejects.toThrowError(BadRequestException);
  });
});
