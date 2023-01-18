import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule, TypeOrmModuleOptions } from '@nestjs/typeorm';
import { DataSource, Not, IsNull, Repository } from 'typeorm';

import {
  BlockedUsers,
  BlockedUsersInterface,
} from '../entity/blocked-users.entity';
import { Channels } from '../entity/channels.entity';
import { Friends } from '../entity/friends.entity';
import {
  generateBlockedUsers,
  generateChannels,
  generateFriends,
  generateUsers,
} from '../../test/generate-mock-data';
import { Relationship, UserId } from '../util/type';
import { UserRelationshipStorage } from './user-relationship.storage';
import { Users } from '../entity/users.entity';
import { BadRequestException, NotFoundException } from '@nestjs/common';

const typeOrmConfig: TypeOrmModuleOptions = {
  type: 'postgres',
  host: 'localhost',
  port: 5432,
  username: 'test_user',
  password: 'test_password',
  database: 'test_db',
  autoLoadEntities: true,
  synchronize: true,
};

describe('UserRelationshipService', () => {
  let userRelationshipStorage: UserRelationshipStorage;
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
    dataSource = await new DataSource({
      type: 'postgres',
      host: 'localhost',
      port: 5432,
      username: 'test_user',
      password: 'test_password',
      database: 'test_db',
      entities: [BlockedUsers, Friends, Users, Channels],
      synchronize: true,
    }).initialize();
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
        TypeOrmModule.forRoot(typeOrmConfig),
        TypeOrmModule.forFeature([BlockedUsers, Friends, Users, Channels]),
      ],
      providers: [UserRelationshipStorage],
    }).compile();

    userRelationshipStorage = module.get<UserRelationshipStorage>(
      UserRelationshipStorage,
    );
    const users = await usersRepository.find({ select: { user_id: true } });
    target = users[Math.floor(Math.random() * users.length)].user_id;
  });

  afterAll(async () => {
    await usersRepository.query('TRUNCATE TABLE users CASCADE');
    await dataSource.destroy();
  });

  it('should be defined', () => {
    expect(userRelationshipStorage).toBeDefined();
  });

  it('should save DM data at init', async () => {
    await userRelationshipStorage.init();

    const dms = await channelRepository.find({
      select: { channel_id: true, owner_id: true, dm_peer_id: true },
      where: { dm_peer_id: Not(IsNull()) },
    });

    dms.forEach(({ channel_id, owner_id, dm_peer_id }) => {
      expect(userRelationshipStorage.isBlockedDm(channel_id)).toBe(
        blockEntities.includes({
          blocker_id: owner_id,
          blocked_id: dm_peer_id,
        }) ||
          blockEntities.includes({
            blocker_id: dm_peer_id,
            blocked_id: owner_id,
          }),
      );
    });
  });

  it('should load relationships of a user', async () => {
    await userRelationshipStorage.load(target);
    const relationshipMap: Map<UserId, Relationship> =
      userRelationshipStorage.getRelationshipMap(target);
    expect(relationshipMap).toBeDefined();
    relationshipMap.forEach(async (value, key) => {
      if (target === key) {
        return;
      }
      if (['friend', 'pendingSender', 'pendingReceiver'].includes(value)) {
        const friendship = await friendsRepository.findBy([
          { sender_id: target, receiver_id: key },
          { sender_id: key, receiver_id: target },
        ]);
        expect(friendship.length).toBe(1);
        const [friends] = friendship;
        if (value === 'friend') {
          return expect(friends.is_accepted).toBe(true);
        }
        expect(friends.is_accepted).toBe(false);
        return expect(
          value === 'pendingSender' ? friends.sender_id : friends.receiver_id,
        ).toBe(target);
      }

      const blockRelationship = await blockedUsersRepository.findBy([
        { blocker_id: target, blocked_id: key },
        { blocker_id: key, blocked_id: target },
      ]);
      expect(blockRelationship.length).toBe(1);
      expect(blockRelationship[0].blocker_id).toBe(
        value === 'blocker' ? target : key,
      );
    });
  });

  it('should unload relationships of a user as the user becomes offline', async () => {
    await userRelationshipStorage.load(target);
    userRelationshipStorage.unload(target);
    expect(userRelationshipStorage.getRelationshipMap(target)).toBeUndefined();
  });

  it('should throw error when delete on nonexistent friendship was attempted', async () => {
    const [userOne, userTwo] = [
      usersPool[3][0].user_id,
      usersPool[3][1].user_id,
    ];
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
    const [sender, receiver] = [
      usersPool[3][0].user_id,
      usersPool[3][1].user_id,
    ];
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
      sender_id: sender,
      receiver_id: receiver,
    });
    expect(newPendingFriendship.length).toEqual(1);
    expect(newPendingFriendship[0].is_accepted).toEqual(false);

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
    const [sender, receiver] = [
      usersPool[3][0].user_id,
      usersPool[3][1].user_id,
    ];
    await userRelationshipStorage.load(sender);

    await userRelationshipStorage.sendFriendRequest(sender, receiver);
    expect(userRelationshipStorage.getRelationship(sender, receiver)).toBe(
      'pendingSender',
    );
    expect(
      userRelationshipStorage.getRelationship(receiver, sender),
    ).toBeNull();

    const newPendingFriendship = await friendsRepository.findBy({
      sender_id: sender,
      receiver_id: receiver,
    });
    expect(newPendingFriendship.length).toEqual(1);
    expect(newPendingFriendship[0].is_accepted).toEqual(false);

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
    const { sender_id, receiver_id } = friendEntities.find(
      ({ is_accepted }) => is_accepted === false,
    );
    await userRelationshipStorage.load(sender_id);
    await userRelationshipStorage.load(receiver_id);
    await userRelationshipStorage.acceptFriendRequest(receiver_id, sender_id);

    expect(
      userRelationshipStorage.getRelationship(receiver_id, sender_id),
    ).toBe('friend');
    expect(
      userRelationshipStorage.getRelationship(sender_id, receiver_id),
    ).toBe('friend');

    expect(
      (
        await friendsRepository.findBy({
          sender_id,
          receiver_id,
          is_accepted: true,
        })
      ).length,
    ).toBe(1);
  });

  it('should accept a friend request (only receiver is loaded & receiver accepts)', async () => {
    const { sender_id, receiver_id } = friendEntities.find(
      ({ is_accepted }) => is_accepted === false,
    );
    await userRelationshipStorage.load(receiver_id);
    await userRelationshipStorage.acceptFriendRequest(receiver_id, sender_id);

    expect(
      userRelationshipStorage.getRelationship(receiver_id, sender_id),
    ).toBe('friend');
    expect(
      userRelationshipStorage.getRelationship(sender_id, receiver_id),
    ).toBeNull();

    expect(
      (
        await friendsRepository.findBy({
          sender_id,
          receiver_id,
          is_accepted: true,
        })
      ).length,
    ).toBe(1);
  });

  it('should throw error when a sender tries to accept his own request (sender loaded)', async () => {
    const { sender_id, receiver_id } = (
      await friendsRepository.findBy({
        is_accepted: false,
      })
    )[0];
    await userRelationshipStorage.load(sender_id);
    expect(
      async () =>
        await userRelationshipStorage.acceptFriendRequest(
          sender_id,
          receiver_id,
        ),
    ).rejects.toThrowError(NotFoundException);

    expect(
      userRelationshipStorage.getRelationship(receiver_id, sender_id),
    ).toBeNull();
    expect(
      userRelationshipStorage.getRelationship(sender_id, receiver_id),
    ).toBe('pendingSender');

    expect(
      (
        await friendsRepository.findBy({
          sender_id,
          receiver_id,
          is_accepted: false,
        })
      ).length,
    ).toBe(1);
  });

  it('should block a user (both loaded)', async () => {
    await userRelationshipStorage.init();
    const { channel_id, owner_id, dm_peer_id } = channelEntities.find(
      ({ dm_peer_id }) => dm_peer_id !== null,
    );
    await userRelationshipStorage.load(owner_id);
    await userRelationshipStorage.load(dm_peer_id);
    await userRelationshipStorage.blockUser(owner_id, dm_peer_id);
    expect(userRelationshipStorage.getRelationship(owner_id, dm_peer_id)).toBe(
      'blocker',
    );
    expect(userRelationshipStorage.getRelationship(dm_peer_id, owner_id)).toBe(
      'blocked',
    );
    expect(userRelationshipStorage.isBlockedDm(channel_id)).toBeTruthy();

    expect(
      (
        await blockedUsersRepository.findBy({
          blocker_id: owner_id,
          blocked_id: dm_peer_id,
        })
      ).length,
    ).toBe(1);

    await userRelationshipStorage.unblockUser(owner_id, dm_peer_id);
    expect(
      userRelationshipStorage.getRelationship(owner_id, dm_peer_id),
    ).toBeNull();
    expect(
      userRelationshipStorage.getRelationship(dm_peer_id, owner_id),
    ).toBeNull();
    expect(
      (
        await blockedUsersRepository.findBy({
          blocker_id: owner_id,
          blocked_id: dm_peer_id,
        })
      ).length,
    ).toBe(0);

    expect(userRelationshipStorage.isBlockedDm(channel_id)).toBeFalsy();
  });

  it('should block a user (only blocker is loaded)', async () => {
    const [blockerId, blockedId] = [
      usersPool[3][0].user_id,
      usersPool[3][1].user_id,
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
          blocker_id: blockerId,
          blocked_id: blockedId,
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
          blocker_id: blockerId,
          blocked_id: blockedId,
        })
      ).length,
    ).toBe(0);
  });

  it('should block a friend and make sure they are no longer friends', async () => {
    const { sender_id, receiver_id } = friendEntities[0];
    const blockerId = receiver_id;
    const blockedId = sender_id;

    await userRelationshipStorage.load(blockerId);

    await userRelationshipStorage.blockUser(blockerId, blockedId);
    expect(userRelationshipStorage.getRelationship(blockerId, blockedId)).toBe(
      'blocker',
    );
    expect(
      userRelationshipStorage.getRelationship(blockedId, blockerId),
    ).toBeNull();

    expect(
      (await friendsRepository.findBy({ sender_id, receiver_id })).length,
    ).toBe(0);
    await userRelationshipStorage.unblockUser(blockerId, blockedId);
    expect(
      userRelationshipStorage.getRelationship(blockerId, blockedId),
    ).toBeNull();
    expect(
      (
        await blockedUsersRepository.findBy({
          blocker_id: blockerId,
          blocked_id: blockedId,
        })
      ).length,
    ).toBe(0);
  });

  it('should throw error when a user who is not a blocker tries to unblock', async () => {
    const { blocker_id, blocked_id } = blockEntities[0];
    await userRelationshipStorage.load(blocked_id);
    expect(
      async () =>
        await userRelationshipStorage.unblockUser(blocked_id, blocker_id),
    ).rejects.toThrowError(BadRequestException);
  });

  it('should throw error when a blocked user tries to set friendship', async () => {
    const { blocker_id, blocked_id } = blockEntities[0];
    await userRelationshipStorage.load(blocker_id);
    await userRelationshipStorage.load(blocked_id);
    expect(
      async () =>
        await userRelationshipStorage.sendFriendRequest(blocker_id, blocked_id),
    ).rejects.toThrowError(BadRequestException);
    expect(
      async () =>
        await userRelationshipStorage.acceptFriendRequest(
          blocked_id,
          blocker_id,
        ),
    ).rejects.toThrowError(BadRequestException);
  });
});
