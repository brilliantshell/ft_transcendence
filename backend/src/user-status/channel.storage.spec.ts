import { DataSource, Repository } from 'typeorm';
import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';

import { BannedMembers } from '../entity/banned-members.entity';
import { ChannelMembers } from '../entity/channel-members.entity';
import { ChannelStorage } from './channel.storage';
import { Channels } from '../entity/channels.entity';
import { Messages } from '../entity/messages.entity';
import {
  TYPEORM_SHARED_CONFIG,
  createDataSources,
  destroyDataSources,
} from '../../test/db-resource-manager';
import { Users } from '../entity/users.entity';
import { UserId, UserRole } from '../util/type';
import {
  generateBannedMembers,
  generateChannelMembers,
  generateChannels,
  generateMessages,
  generateUsers,
} from '../../test/generate-mock-data';

const TEST_DB = 'test_db_channel_storage';
const ENTITIES = [BannedMembers, ChannelMembers, Channels, Messages, Users];

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
      providers: [ChannelStorage],
    }).compile();

    storage = module.get<ChannelStorage>(ChannelStorage);
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
});
