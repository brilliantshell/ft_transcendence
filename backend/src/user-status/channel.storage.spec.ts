import { DataSource, MoreThan, MoreThanOrEqual, Repository } from 'typeorm';
import { DateTime } from 'luxon';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AccessMode, Channels } from '../entity/channels.entity';
import { BannedMembers } from '../entity/banned-members.entity';
import { BlockedUsers } from '../entity/blocked-users.entity';
import { ChannelMembers } from '../entity/channel-members.entity';
import { ChannelStorage } from './channel.storage';
import { Messages } from '../entity/messages.entity';
import {
  TYPEORM_SHARED_CONFIG,
  createDataSources,
  destroyDataSources,
} from '../../test/util/db-resource-manager';
import { Users } from '../entity/users.entity';
import { UserId, UserRole } from '../util/type';
import { UserRelationshipStorage } from './user-relationship.storage';
import {
  generateBannedMembers,
  generateChannelMembers,
  generateChannels,
  generateMessages,
  generateUsers,
} from '../../test/util/generate-mock-data';

const TEST_DB = 'test_db_channel_storage';
const ENTITIES = [
  BannedMembers,
  BlockedUsers,
  ChannelMembers,
  Channels,
  Messages,
  Users,
];

describe('ChannelStorage', () => {
  let dataSource: DataSource;
  let initDataSource: DataSource;
  let storage: ChannelStorage;
  let userEntities: Users[];
  let channelEntities: Channels[];
  let messagesEntities: Messages[];
  let channelMembersEntities: ChannelMembers[];
  let bannedMembersEntities: BannedMembers[];
  let usersRepository: Repository<Users>;
  let channelsRepository: Repository<Channels>;
  let channelMembersRepository: Repository<ChannelMembers>;
  let messagesRepository: Repository<Messages>;
  let bannedMembersRepository: Repository<BannedMembers>;
  let userRelationshipStorage: UserRelationshipStorage;

  beforeAll(async () => {
    const dataSources = await createDataSources(TEST_DB, ENTITIES);
    initDataSource = dataSources.initDataSource;
    dataSource = dataSources.dataSource;
    userEntities = generateUsers(300);
    channelEntities = generateChannels(userEntities);

    usersRepository = dataSource.getRepository(Users);
    bannedMembersRepository = dataSource.getRepository(BannedMembers);
    channelsRepository = dataSource.getRepository(Channels);
    channelMembersRepository = dataSource.getRepository(ChannelMembers);
    messagesRepository = dataSource.getRepository(Messages);

    await usersRepository.save(userEntities);
    await channelsRepository.save(channelEntities);

    channelMembersEntities = generateChannelMembers(
      userEntities,
      await channelsRepository.find(),
    );
    await channelMembersRepository.save(channelMembersEntities);

    messagesEntities = generateMessages(channelMembersEntities);
    await messagesRepository.save(messagesEntities);
    messagesEntities = await messagesRepository.find();

    bannedMembersEntities = generateBannedMembers(channelMembersEntities);
    await bannedMembersRepository.save(bannedMembersEntities);

    let idx = 0;
    for (const { channelId } of channelEntities) {
      const latestMessage = messagesEntities
        .filter((message) => message.channelId === channelId)
        .sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis())[0];
      await channelsRepository.update(channelId, {
        modifiedAt: latestMessage.createdAt,
      });
      channelEntities[idx].modifiedAt = latestMessage.createdAt;
      ++idx;
    }
    idx = 0;
    for (const { channelId, memberId } of channelMembersEntities) {
      const latestMessage = messagesEntities
        .filter((message) => message.channelId === channelId)
        .sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis())[0];
      await channelMembersRepository.update(
        { channelId, memberId },
        { viewedAt: latestMessage.createdAt },
      );
      channelMembersEntities[idx].viewedAt = latestMessage.createdAt;
      ++idx;
    }
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'postgres',
          ...TYPEORM_SHARED_CONFIG,
          autoLoadEntities: true,
          database: TEST_DB,
          logger: 'advanced-console',
          // logging: true,
        }),
        TypeOrmModule.forFeature(ENTITIES),
      ],
      providers: [ChannelStorage, UserRelationshipStorage],
    }).compile();

    await module.init();
    storage = module.get<ChannelStorage>(ChannelStorage);
    userRelationshipStorage = module.get<UserRelationshipStorage>(
      UserRelationshipStorage,
    );
  });

  afterAll(
    async () => await destroyDataSources(TEST_DB, dataSource, initDataSource),
  );

  it('should be defined', () => {
    expect(storage).toBeDefined();
  });

  it('should cache channel info at app bootstrap', async () => {
    const cachedChannels = storage.getChannels();
    expect(cachedChannels.size).toBe(channelEntities.length);
    const orderedChannels = channelEntities.sort(
      (a, b) => a.channelId - b.channelId,
    );
    let idx = 0;
    cachedChannels.forEach((channelInfo, channelId) => {
      expect(channelId).toEqual(orderedChannels[idx].channelId);
      expect(channelInfo.accessMode).toEqual(orderedChannels[idx].accessMode);
      expect(channelInfo.modifiedAt).toEqual(orderedChannels[idx].modifiedAt);
      const members = channelMembersEntities.filter(
        (entity) => entity.channelId === channelId,
      );
      const membersMap = new Map<UserId, UserRole>();
      membersMap.set(orderedChannels[idx].ownerId, 'owner');
      members.forEach(({ memberId, isAdmin }) => {
        if (memberId === orderedChannels[idx].ownerId) {
          return;
        }
        membersMap.set(memberId, isAdmin ? 'admin' : 'member');
      });
      expect(channelInfo.userRoleMap).toEqual(membersMap);
      ++idx;
    });
  });

  it(`should cache a user's status in channels in which the user is`, async () => {
    const { userId } = userEntities[0];
    await storage.loadUser(userId);
    const cachedUser = storage.getUser(userId);

    const memberships = await channelMembersRepository.find({
      where: {
        memberId: userId,
      },
      select: {
        channelId: true,
        viewedAt: true as any,
        muteEndAt: true as any,
      },
    });
    for (const { channelId, viewedAt, muteEndAt } of memberships) {
      const cache = cachedUser.get(channelId);
      expect(muteEndAt).toEqual(cache.muteEndAt);
      expect(cache.unseenCount).toBe(
        await messagesRepository.countBy({
          channelId,
          createdAt: MoreThan(viewedAt),
        }),
      );
      expect(cachedUser.size).toEqual(
        new Set(
          channelMembersEntities
            .map(({ channelId, memberId }) =>
              memberId === userId ? channelId : null,
            )
            .filter((channelId) => channelId !== null),
        ).size,
      );
    }
  });

  it('should delete a user-channels info of a user from cache when the user leaves the service', async () => {
    const { userId } = userEntities[1];
    await storage.loadUser(userId);
    const cachedUser = storage.getUser(userId);
    expect(cachedUser.size).toEqual(
      new Set(
        channelMembersEntities
          .map(({ channelId, memberId }) =>
            memberId === userId ? channelId : null,
          )
          .filter((channelId) => channelId !== null),
      ).size,
    );
    storage.unloadUser(userId);
    expect(storage.getUser(userId)).toBeUndefined();
  });

  it('should add a new member to an existing channel', async () => {
    const { userId } = userEntities[2];
    await storage.loadUser(userId);
    const { channelId } = channelMembersEntities.filter(
      ({ memberId }) => memberId !== userId,
    )[0];

    const prevCnt = (
      await channelsRepository.findOne({
        where: { channelId },
        select: { memberCount: true },
      })
    ).memberCount;
    await storage.addUserToChannel(channelId, userId);
    let channelInfo = storage.getChannel(channelId);
    expect(channelInfo.userRoleMap.has(userId)).toBeTruthy();
    expect(channelInfo.userRoleMap.get(userId)).toEqual('member');

    const [membership] = await channelMembersRepository.findBy({
      channelId,
      memberId: userId,
    });
    expect(membership).toBeDefined();
    expect(membership.isAdmin).toBeFalsy();

    expect(
      (
        await channelsRepository.findOne({
          where: { channelId },
          select: { memberCount: true },
        })
      ).memberCount,
    ).toBe(prevCnt + 1);

    let cachedUser = storage.getUser(userId);
    expect(cachedUser.has(channelId)).toBeTruthy();
    expect(cachedUser.get(channelId)).toEqual({
      unseenCount: 0,
      muteEndAt: DateTime.fromMillis(0),
    });

    await storage.deleteUserFromChannel(channelId, userId);
    channelInfo = storage.getChannel(channelId);
    expect(channelInfo.userRoleMap.has(userId)).toBeFalsy();

    expect(
      (
        await channelsRepository.findOne({
          where: { channelId },
          select: { memberCount: true },
        })
      ).memberCount,
    ).toBe(prevCnt);

    cachedUser = storage.getUser(userId);
    expect(cachedUser.has(channelId)).toBeFalsy();
    expect(
      await channelMembersRepository.exist({
        where: { channelId, memberId: userId },
      }),
    ).toBeFalsy();
  });

  it('should add a new channel to cache (NOT DM)', async () => {
    const { userId } = userEntities[42];
    await storage.loadUser(userId);
    const newChannelId = await storage.addChannel(
      AccessMode.PROTECTED,
      userId,
      'new channel',
      'password',
    );
    const channelInfo = storage.getChannel(newChannelId);
    expect(channelInfo).toBeDefined();

    const [channelData] = await channelsRepository.findBy({
      channelId: newChannelId,
    });

    expect(channelData.memberCount).toBe(1);
    expect(channelData.ownerId).toBe(userId);
    expect(channelData.accessMode).toBe(AccessMode.PROTECTED);
    expect(channelData.name).toBe('new channel');
    expect(channelData.password.toString()).toBe('password');

    const members = await channelMembersRepository.findBy({
      channelId: newChannelId,
    });
    expect(members.length).toBe(1);
    expect(members[0].memberId).toBe(userId);
    expect(members[0].isAdmin).toBeTruthy();
    expect(members[0].muteEndAt).toEqual(DateTime.fromMillis(0));

    expect(channelInfo.accessMode).toBe(channelData.accessMode);
    expect(channelInfo.userRoleMap).toEqual(
      new Map<UserId, UserRole>().set(userId, 'owner'),
    );
    expect(channelInfo.modifiedAt).toEqual(channelData.modifiedAt);

    expect(storage.getUser(userId).has(newChannelId)).toBeTruthy();
    expect(storage.getUser(userId).get(newChannelId)).toEqual({
      unseenCount: 0,
      muteEndAt: DateTime.fromMillis(0),
    });
  });

  it('should add a new channel to cache (DM)', async () => {
    const { userId, nickname } = userEntities[43];
    const nonDm = channelEntities.filter(
      (channel) =>
        !(
          (channel.ownerId === userId && channel.dmPeerId) ||
          channel.dmPeerId === userId
        ),
    )[0];
    const peerId = nonDm.ownerId === userId ? nonDm.dmPeerId : nonDm.ownerId;
    await storage.loadUser(userId);
    const newChannelId = await storage.addDm(userId, peerId);
    const channelInfo = storage.getChannel(newChannelId);
    expect(channelInfo).toBeDefined();

    const [channelData] = await channelsRepository.findBy({
      channelId: newChannelId,
    });

    const peer = userEntities.find((user) => user.userId === peerId);

    expect(channelData.memberCount).toBe(2);
    expect(channelData.ownerId).toBe(userId);
    expect(channelData.dmPeerId).toBe(peerId);
    expect(channelData.accessMode).toBe(AccessMode.PRIVATE);
    expect(channelData.name).toBe(`${nickname}, ${peer.nickname}`);

    const members = await channelMembersRepository.findBy({
      channelId: newChannelId,
    });
    expect(members.length).toBe(2);
    expect(members[0].memberId).toBe(userId);
    expect(members[0].isAdmin).toBeFalsy();
    expect(members[0].muteEndAt).toEqual(DateTime.fromMillis(0));

    expect(channelInfo.accessMode).toBe(channelData.accessMode);
    expect(channelInfo.userRoleMap).toEqual(
      new Map<UserId, UserRole>().set(userId, 'owner').set(peerId, 'member'),
    );
    expect(channelInfo.modifiedAt).toEqual(channelData.modifiedAt);
    expect(channelInfo.modifiedAt).toEqual(channelData.modifiedAt);

    expect(storage.getUser(userId).has(newChannelId)).toBeTruthy();
    expect(storage.getUser(userId).get(newChannelId)).toEqual({
      unseenCount: 0,
      muteEndAt: DateTime.fromMillis(0),
    });

    expect(userRelationshipStorage.isBlockedDm(newChannelId)).toBeFalsy();

    storage.deleteUserFromChannel(newChannelId, userId);
  });

  it('should delete a channel when the owner of the channel leaves the channel', async () => {
    const { ownerId, channelId } = channelEntities.find((channel) => {
      return channel.memberCount > 3;
    });
    const members = channelMembersEntities
      .filter((member) => member.channelId === channelId)
      .map(({ memberId }) => memberId);
    await storage.loadUser(ownerId);
    for (const member of members) {
      await storage.loadUser(member);
    }
    await storage.deleteUserFromChannel(channelId, ownerId);
    expect(storage.getChannel(channelId)).toBeUndefined();
    expect(storage.getUser(ownerId).has(channelId)).toBeFalsy();
    members.forEach((member) => {
      expect(storage.getUser(member).has(channelId)).toBeFalsy();
    });
    expect(
      await channelsRepository.exist({ where: { channelId } }),
    ).toBeFalsy();
    expect(
      await channelMembersRepository.exist({ where: { channelId } }),
    ).toBeFalsy();
  });

  it('should update the role of a user in a chatroom', async () => {
    const [nonDmChannel] = await channelsRepository.find({
      where: { memberCount: MoreThanOrEqual(3) },
    });
    if (!nonDmChannel) {
      return console.log('ROLE UPDATE TEST SKIPPED!!!');
    }
    const [member] = await channelMembersRepository.find({
      where: { channelId: nonDmChannel.channelId, isAdmin: false },
    });
    if (!member) {
      return console.log('ROLE UPDATE TEST SKIPPED!!!');
    }

    await storage.updateUserRole(
      nonDmChannel.channelId,
      member.memberId,
      'admin',
    );
    expect(storage.getUserRole(nonDmChannel.channelId, member.memberId)).toBe(
      'admin',
    );
    expect(
      (
        await channelMembersRepository.findOneBy({
          channelId: nonDmChannel.channelId,
          memberId: member.memberId,
        })
      ).isAdmin,
    ).toBeTruthy();
  });

  it.skip('should throw FORBIDDEN error when  user does not have appropriate authority to change the role of another user', async () => {
    const nonDmChannels = await channelsRepository.find({
      where: { memberCount: MoreThanOrEqual(3) },
    });
    if (nonDmChannels.length < 2) {
      return console.log('FORBIDDEN ROLE CHANGE TEST SKIPPED!!!!!!');
    }
    const nonDmChannel = nonDmChannels[1];
    const [member] = await channelMembersRepository.find({
      where: { channelId: nonDmChannel.channelId, isAdmin: false },
    });
    if (!member) {
      return console.log('FORBIDDEN ROLE CHANGE TEST SKIPPED');
    }
    expect(
      async () =>
        await storage.updateUserRole(
          nonDmChannel.channelId,
          nonDmChannel.ownerId,
          'admin',
        ),
    ).rejects.toThrowError(ForbiddenException);
  });

  it("should update a channel's 'modified_at' time when a message is sent to a chat room", async () => {
    const { channelId, ownerId } = channelEntities[39];
    const messageCreatedAt = DateTime.now();
    await messagesRepository.insert({
      channelId,
      senderId: ownerId,
      contents: 'test',
      createdAt: messageCreatedAt,
    });
    await storage.updateChannelModifiedAt(channelId, messageCreatedAt);
    expect(
      (await channelsRepository.findOneBy({ channelId })).modifiedAt,
    ).toEqual(messageCreatedAt);
    expect(storage.getChannel(channelId).modifiedAt).toEqual(messageCreatedAt);
  });

  it('should update mute status of a non-admin member in a chat room', async () => {
    const nonDmChannels = await channelsRepository.find({
      where: { memberCount: MoreThanOrEqual(3) },
    });
    if (nonDmChannels.length < 3) {
      console.log('MUTE TEST SKIPPED!!!!');
      return;
    }
    const nonDmChannel = nonDmChannels[2];
    const members = await channelMembersRepository.find({
      where: { channelId: nonDmChannel.channelId, isAdmin: false },
    });
    if (members.length === 0) {
      console.log('MUTE TEST SKIPPED!!!!');
      return;
    }
    const member = members[0];
    await storage.loadUser(member.memberId);
    const muteEndAt = DateTime.now().plus({ days: 1 });
    await storage.updateMuteStatus(
      nonDmChannel.channelId,
      member.memberId,
      muteEndAt,
    );
    expect(
      (
        await channelMembersRepository.findOneBy({
          channelId: nonDmChannel.channelId,
          memberId: member.memberId,
        })
      ).muteEndAt,
    ).toEqual(muteEndAt);
    expect(
      storage.getUser(member.memberId).get(nonDmChannel.channelId).muteEndAt,
    ).toEqual(muteEndAt);
  });

  // skip this test because this case is not possible
  it.skip(`should throw BAD REQUEST when a user's mute end time is set to the past`, async () => {
    const nonDmChannels = await channelsRepository.find({
      where: { memberCount: MoreThanOrEqual(3) },
    });
    if (nonDmChannels.length < 4) {
      console.log('BAD REQUEST IN MUTE TEST SKIPPED!!!');
      return;
    }
    const nonDmChannel = nonDmChannels[3];
    const [member] = await channelMembersRepository.find({
      where: { channelId: nonDmChannel.channelId, isAdmin: false },
    });
    if (!member) {
      return console.log('BAD REQUEST IN MUTE TEST SKIPPED!!!');
    }
    await storage.loadUser(member.memberId);
    const muteEndAt = DateTime.now().minus({ millisecond: 1 });
    expect(
      async () =>
        await storage.updateMuteStatus(
          nonDmChannel.channelId,
          member.memberId,
          muteEndAt,
        ),
    ).rejects.toThrowError(BadRequestException);
  });

  it("should update a user's a number of unseen messages in a chat room", async () => {
    const channel = await channelsRepository.findOneBy({ dmPeerId: null });
    const members = await channelMembersRepository.find({
      where: { channelId: channel.channelId },
    });
    const [memberOne, memberTwo] = members;
    await storage.loadUser(memberOne.memberId);
    await storage.loadUser(memberTwo.memberId);
    const prevOneCount = storage
      .getUser(memberOne.memberId)
      .get(channel.channelId).unseenCount;
    const prevTwoCount = storage
      .getUser(memberTwo.memberId)
      .get(channel.channelId).unseenCount;
    expect(prevOneCount).toBe(
      await messagesRepository.countBy({
        channelId: channel.channelId,
        createdAt: MoreThan(memberOne.viewedAt),
      }),
    );
    expect(prevTwoCount).toBe(
      await messagesRepository.countBy({
        channelId: channel.channelId,
        createdAt: MoreThan(memberTwo.viewedAt),
      }),
    );
    storage.updateUnseenCount(channel.channelId, memberOne.memberId, true);
    expect(
      storage.getUser(memberOne.memberId).get(channel.channelId).unseenCount,
    ).toBe(0);
    const messageCreatedAt = DateTime.now();
    await messagesRepository.insert({
      channelId: channel.channelId,
      senderId: memberOne.memberId,
      contents: 'test',
      createdAt: messageCreatedAt,
    });
    storage.updateUnseenCount(channel.channelId, memberTwo.memberId);
    expect(
      storage.getUser(memberTwo.memberId).get(channel.channelId).unseenCount,
    ).toBe(prevTwoCount + 1);
  });

  it('should ban a user from a chat room', async () => {
    const [owner, member] = userEntities;
    await storage.loadUser(owner.userId);
    await storage.loadUser(member.userId);
    const nonDmChannel = await storage.addChannel(
      AccessMode.PUBLIC,
      owner.userId,
      'banbanbanana',
      null,
    );
    await storage.addUserToChannel(nonDmChannel, member.userId);
    const banEndAt = DateTime.now().plus({ hours: 1 });
    await storage.banUser(nonDmChannel, member.userId, banEndAt);

    expect(
      (
        await bannedMembersRepository.findOne({
          where: {
            channelId: nonDmChannel,
            memberId: member.userId,
          },
          select: {
            endAt: true as any,
          },
        })
      ).endAt,
    ).toEqual(banEndAt);
    expect(
      (await storage.getBanEndAt(nonDmChannel, member.userId)).toMillis(),
    ).toBeGreaterThan(DateTime.now().toMillis());
    expect(
      (await channelsRepository.findOneBy({ channelId: nonDmChannel }))
        .memberCount,
    ).toBe(1);
    const membersMap = storage.getChannel(nonDmChannel).userRoleMap;
    expect(membersMap.size === 1 && membersMap.has(owner.userId)).toBeTruthy();
    expect(storage.getUser(member.userId).get(nonDmChannel)).toBeUndefined();
  });
});
