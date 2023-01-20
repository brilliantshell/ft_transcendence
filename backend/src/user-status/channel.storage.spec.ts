import { DataSource, Repository } from 'typeorm';
import { DateTime } from 'luxon';
import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';

import { BannedMembers } from '../entity/banned-members.entity';
import { ChannelMembers } from '../entity/channel-members.entity';
import { ChannelStorage } from './channel.storage';
import { AccessMode, Channels } from '../entity/channels.entity';
import { Messages } from '../entity/messages.entity';
import {
  TYPEORM_SHARED_CONFIG,
  createDataSources,
  destroyDataSources,
} from '../../test/db-resource-manager';
import { Users } from '../entity/users.entity';
import { UserId, UserRole } from '../util/type';
import { UserRelationshipStorage } from './user-relationship.storage';
import {
  generateBannedMembers,
  generateChannelMembers,
  generateChannels,
  generateMessages,
  generateUsers,
} from '../../test/generate-mock-data';
import { BlockedUsers } from '../entity/blocked-users.entity';
import { Friends } from '../entity/friends.entity';

const TEST_DB = 'test_db_channel_storage';
const ENTITIES = [
  Friends,
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

    channelEntities.forEach(async ({ channel_id }, idx) => {
      const latestMessage = messagesEntities
        .filter((message) => message.channel_id === channel_id)
        .sort((a, b) => b.created_at.toMillis() - a.created_at.toMillis())[0];
      await channelsRepository.update(channel_id, {
        modified_at: latestMessage.created_at,
      });
      channelEntities[idx].modified_at = latestMessage.created_at;
    });
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
        }),
        TypeOrmModule.forFeature(ENTITIES),
      ],
      providers: [ChannelStorage, UserRelationshipStorage],
    }).compile();

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
    await storage.initChannels();
    const cachedChannels = storage.getChannels();
    expect(cachedChannels.size).toBe(channelEntities.length);
    const orderedChannels = channelEntities.sort(
      (a, b) => a.channel_id - b.channel_id,
    );
    let idx = 0;
    cachedChannels.forEach((channelInfo, channelId) => {
      expect(channelId).toEqual(orderedChannels[idx].channel_id);
      expect(channelInfo.accessMode).toEqual(orderedChannels[idx].access_mode);
      expect(channelInfo.modifiedAt).toEqual(orderedChannels[idx].modified_at);
      const members = channelMembersEntities.filter(
        ({ channel_id }) => channel_id === channelId,
      );
      const membersMap = new Map<UserId, UserRole>();
      membersMap.set(orderedChannels[idx].owner_id, 'owner');
      members.forEach(({ member_id, is_admin }) => {
        if (member_id === orderedChannels[idx].owner_id) {
          return;
        }
        membersMap.set(member_id, is_admin ? 'admin' : 'normal');
      });
      expect(channelInfo.userRoleMap).toEqual(membersMap);
      ++idx;
    });
  });

  it(`should cache a user's status in a channel in which the user is`, async () => {
    const { user_id } = userEntities[0];
    await storage.loadUser(user_id);
    const cachedUser = storage.getUser(user_id);

    const memberships = await channelMembersRepository.find({
      relations: ['channel'],
      where: {
        member_id: user_id,
      },
      select: {
        channel_id: true,
        viewed_at: true as any,
        mute_end_time: true as any,
        channel: { modified_at: true as any },
      },
    });

    memberships.forEach(async (membership) => {
      const { channel_id, channel, viewed_at, mute_end_time } = membership;
      const { modified_at } = channel;
      const { muteEndTime, unseenCount } = cachedUser.get(channel_id);
      expect(muteEndTime).toEqual(mute_end_time);
      if (viewed_at >= modified_at) {
        expect(unseenCount).toEqual(0);
        return;
      }
      expect(unseenCount).toEqual(
        messagesEntities.filter((message) => {
          if (message.channel_id !== channel_id) {
            return false;
          }
          return message.created_at.toMillis() > viewed_at.toMillis()
            ? true
            : false;
        }).length,
      );
    });

    expect(cachedUser.size).toEqual(
      new Set(
        channelMembersEntities
          .map(({ channel_id, member_id }) =>
            member_id === user_id ? channel_id : null,
          )
          .filter((channelId) => channelId !== null),
      ).size,
    );
  });

  it('should delete a user-channels info of a user from cache when the user leaves the service', async () => {
    const { user_id } = userEntities[1];
    await storage.loadUser(user_id);
    const cachedUser = storage.getUser(user_id);
    expect(cachedUser.size).toEqual(
      new Set(
        channelMembersEntities
          .map(({ channel_id, member_id }) =>
            member_id === user_id ? channel_id : null,
          )
          .filter((channelId) => channelId !== null),
      ).size,
    );
    storage.unloadUser(user_id);
    expect(storage.getUser(user_id)).toBeUndefined();
  });

  it('should add a new member to an existing channel', async () => {
    await storage.initChannels();
    const { user_id } = userEntities[2];
    await storage.loadUser(user_id);
    const { channel_id } = channelMembersEntities.filter(
      ({ member_id }) => member_id !== user_id,
    )[0];

    const prevCnt = (
      await channelsRepository.findOne({
        where: { channel_id },
        select: { member_cnt: true },
      })
    ).member_cnt;
    await storage.addUserToChannel(channel_id, user_id);
    let channelInfo = storage.getChannel(channel_id);
    expect(channelInfo.userRoleMap.has(user_id)).toBeTruthy();
    expect(channelInfo.userRoleMap.get(user_id)).toEqual('normal');

    const [membership] = await channelMembersRepository.findBy({
      channel_id,
      member_id: user_id,
    });
    expect(membership).toBeDefined();
    expect(membership.is_admin).toBeFalsy();

    expect(
      (
        await channelsRepository.findOne({
          where: { channel_id },
          select: { member_cnt: true },
        })
      ).member_cnt,
    ).toBe(prevCnt + 1);

    let cachedUser = storage.getUser(user_id);
    expect(cachedUser.has(channel_id)).toBeTruthy();
    expect(cachedUser.get(channel_id)).toEqual({
      unseenCount: 0,
      muteEndTime: DateTime.fromMillis(0),
    });

    await storage.deleteUserFromChannel(channel_id, user_id);
    channelInfo = storage.getChannel(channel_id);
    expect(channelInfo.userRoleMap.has(user_id)).toBeFalsy();

    expect(
      (
        await channelsRepository.findOne({
          where: { channel_id },
          select: { member_cnt: true },
        })
      ).member_cnt,
    ).toBe(prevCnt);

    cachedUser = storage.getUser(user_id);
    expect(cachedUser.has(channel_id)).toBeFalsy();
    expect(
      await channelMembersRepository.exist({
        where: { channel_id, member_id: user_id },
      }),
    ).toBeFalsy();
  });

  it('should add a new channel to cache (NOT DM)', async () => {
    const { user_id } = userEntities[42];
    await storage.loadUser(user_id);
    const newChannelId = await storage.addChannel({
      accessMode: AccessMode.PROTECTED,
      name: 'new channel',
      owner: user_id,
      password: 'password',
    });
    const channelInfo = storage.getChannel(newChannelId);
    expect(channelInfo).toBeDefined();

    const [channelData] = await channelsRepository.findBy({
      channel_id: newChannelId,
    });

    expect(channelData.member_cnt).toBe(1);
    expect(channelData.owner_id).toBe(user_id);
    expect(channelData.access_mode).toBe(AccessMode.PROTECTED);
    expect(channelData.name).toBe('new channel');
    expect(channelData.password.toString()).toBe('password');

    const members = await channelMembersRepository.findBy({
      channel_id: newChannelId,
    });
    expect(members.length).toBe(1);
    expect(members[0].member_id).toBe(user_id);
    expect(members[0].is_admin).toBeTruthy();
    expect(members[0].mute_end_time).toEqual(DateTime.fromMillis(0));

    expect(channelInfo.accessMode).toBe(channelData.access_mode);
    expect(channelInfo.userRoleMap).toEqual(
      new Map<UserId, UserRole>().set(user_id, 'owner'),
    );
    expect(channelInfo.modifiedAt).toEqual(channelData.modified_at);

    expect(storage.getUser(user_id).has(newChannelId)).toBeTruthy();
    expect(storage.getUser(user_id).get(newChannelId)).toEqual({
      unseenCount: 0,
      muteEndTime: DateTime.fromMillis(0),
    });
  });

  it('should add a new channel to cache (DM)', async () => {
    await storage.initChannels();
    const { user_id, nickname } = userEntities[43];
    const nonDm = channelEntities.filter(
      (channel) =>
        !(
          (channel.owner_id === user_id && channel.dm_peer_id) ||
          channel.dm_peer_id === user_id
        ),
    )[0];
    const peerId =
      nonDm.owner_id === user_id ? nonDm.dm_peer_id : nonDm.owner_id;
    await storage.loadUser(user_id);
    const newChannelId = await storage.addChannel({
      accessMode: AccessMode.PRIVATE,
      owner: user_id,
      dmPeerId: peerId,
    });
    const channelInfo = storage.getChannel(newChannelId);
    expect(channelInfo).toBeDefined();

    const [channelData] = await channelsRepository.findBy({
      channel_id: newChannelId,
    });

    const peer = userEntities.find((user) => user.user_id === peerId);

    expect(channelData.member_cnt).toBe(2);
    expect(channelData.owner_id).toBe(user_id);
    expect(channelData.dm_peer_id).toBe(peerId);
    expect(channelData.access_mode).toBe(AccessMode.PRIVATE);
    expect(channelData.name).toBe(`${nickname}, ${peer.nickname}`);

    const members = await channelMembersRepository.findBy({
      channel_id: newChannelId,
    });
    expect(members.length).toBe(2);
    expect(members[0].member_id).toBe(user_id);
    expect(members[0].is_admin).toBeTruthy();
    expect(members[0].mute_end_time).toEqual(DateTime.fromMillis(0));

    expect(channelInfo.accessMode).toBe(channelData.access_mode);
    expect(channelInfo.userRoleMap).toEqual(
      new Map<UserId, UserRole>().set(user_id, 'owner'),
    );
    expect(channelInfo.modifiedAt).toEqual(channelData.modified_at);

    expect(storage.getUser(user_id).has(newChannelId)).toBeTruthy();
    expect(storage.getUser(user_id).get(newChannelId)).toEqual({
      unseenCount: 0,
      muteEndTime: DateTime.fromMillis(0),
    });

    expect(userRelationshipStorage.isBlockedDm(newChannelId)).toBeFalsy();

    storage.deleteUserFromChannel(newChannelId, user_id);
  });

  it('should delete a channel when the owner of the channel leaves the channel', async () => {
    await storage.initChannels();
    const { owner_id, channel_id } = channelEntities.find((channel) => {
      return channel.member_cnt > 3;
    });
    const members = channelMembersEntities
      .filter((member) => member.channel_id === channel_id)
      .map(({ member_id }) => member_id);
    await storage.loadUser(owner_id);
    members.forEach(async (member) => await storage.loadUser(member));
    await storage.deleteUserFromChannel(channel_id, owner_id);
    expect(storage.getChannel(channel_id)).toBeUndefined();
    expect(storage.getUser(owner_id).has(channel_id)).toBeFalsy();
    members.forEach((member) => {
      expect(storage.getUser(member).has(channel_id)).toBeFalsy();
    });
    expect(
      await channelsRepository.exist({ where: { channel_id } }),
    ).toBeFalsy();
    expect(
      await channelMembersRepository.exist({ where: { channel_id } }),
    ).toBeFalsy();
  });
});
