import { BadRequestException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { compare } from 'bcrypt';

import { BannedMembers } from '../entity/banned-members.entity';
import { ChannelMembers } from '../entity/channel-members.entity';
import { ChannelStorage } from '../user-status/channel.storage';
import { Channels } from '../entity/channels.entity';
import { ChatsGateway } from './chats.gateway';
import { ChatsService } from './chats.service';
import { Messages } from '../entity/messages.entity';
import { NewChannelDto } from './dto/chats.dto';
import { UserRelationshipStorage } from '../user-status/user-relationship.storage';
import { UserStatusModule } from '../user-status/user-status.module';
import { Users } from '../entity/users.entity';
import {
  TYPEORM_SHARED_CONFIG,
  createDataSources,
  destroyDataSources,
} from '../../test/db-resource-manager';
import {
  generateBannedMembers,
  generateChannelMembers,
  generateChannels,
  generateUsers,
} from '../../test/generate-mock-data';

const TEST_DB = 'test_db_chat_service';
const ENTITIES = [BannedMembers, ChannelMembers, Channels, Messages, Users];

describe('ChatsService', () => {
  let dataSource: DataSource;
  let initDataSource: DataSource;
  let service: ChatsService;
  let userRelationshipStorage: UserRelationshipStorage;
  let channelStorage: ChannelStorage;
  let usersEntities: Users[];
  let channelsEntities: Channels[];
  let channelMembersEntities: ChannelMembers[];
  let messagesEntities: Messages[];
  let bannedMembersEntities: BannedMembers[];

  beforeAll(async () => {
    const dataSources = await createDataSources(TEST_DB, ENTITIES);
    initDataSource = dataSources.initDataSource;
    dataSource = dataSources.dataSource;
    usersEntities = generateUsers(10);
    channelsEntities = generateChannels(usersEntities);
    await dataSource.getRepository(Users).save(usersEntities);
    await dataSource.getRepository(Channels).save(channelsEntities);
    channelsEntities = await dataSource.getRepository(Channels).find();
    channelMembersEntities = generateChannelMembers(
      usersEntities,
      channelsEntities,
    );
    bannedMembersEntities = generateBannedMembers(channelMembersEntities);
    await dataSource.getRepository(ChannelMembers).save(channelMembersEntities);
    await dataSource.getRepository(BannedMembers).save(bannedMembersEntities);
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        UserStatusModule,
        TypeOrmModule.forRoot({
          type: 'postgres',
          ...TYPEORM_SHARED_CONFIG,
          autoLoadEntities: true,
          database: TEST_DB,
        }),
        TypeOrmModule.forFeature([Channels]),
      ],
      providers: [ChatsGateway, ChatsService],
    }).compile();

    module.init();
    service = module.get<ChatsService>(ChatsService);
    userRelationshipStorage = module.get<UserRelationshipStorage>(
      UserRelationshipStorage,
    );
    channelStorage = module.get<ChannelStorage>(ChannelStorage);
    for (const u of usersEntities) {
      await userRelationshipStorage.load(u.userId);
      await channelStorage.loadUser(u.userId);
    }
  });

  afterAll(() => {
    destroyDataSources(TEST_DB, dataSource, initDataSource);
  });
  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should be able to find the user joined channels sorted by modifiedAt and all public channels sorted a-z', async () => {
    // case : public channels exist && user has joined channels
    const userId = usersEntities[0].userId;
    const result = await service.findAllChannels(userId);
    const joinedChannels = channelMembersEntities
      .filter((channelMember) => channelMember.memberId === userId)
      .map((channelMember) =>
        channelsEntities.find((v) => v.channelId == channelMember.channelId),
      )
      .sort((a, b) => a.modifiedAt.valueOf() - b.modifiedAt.valueOf())
      .map((channel) => {
        return {
          channelId: channel.channelId,
          channelName: channel.name,
          isDm: channel.dmPeerId !== null,
          memberCount: channelStorage.getChannel(channel.channelId).userRoleMap
            .size,
          accessMode: channel.accessMode,
          unseenCount: channelStorage.getUser(userId).get(channel.channelId)
            .unseenCount,
        };
      });

    const filterSet = new Set();
    const otherChannels = channelMembersEntities
      .filter((channelMember) => {
        if (filterSet.has(channelMember.channelId)) {
          return false;
        }
        filterSet.add(channelMember.channelId);
        if (
          !channelStorage.getUser(userId).has(channelMember.channelId) &&
          channelsEntities.find((v) => v.channelId == channelMember.channelId)
            .accessMode !== 'private'
        )
          return true;
        return false;
      })
      .map((channelMember) => {
        return channelsEntities.find(
          (v) => v.channelId == channelMember.channelId,
        );
      })
      .map((channel) => {
        return {
          channelId: channel.channelId,
          channelName: channel.name,
          memberCount: channelStorage.getChannel(channel.channelId).userRoleMap
            .size,
          accessMode: channel.accessMode as 'public' | 'protected',
        };
      })
      .sort((a, b) => a.channelName.localeCompare(b.channelName));
    expect(result).toEqual({ joinedChannels, otherChannels });
  });

  it('should be able to find all public channels sorted a-z and user does not joined any channel', async () => {
    // case : public channels exist && user does not have joined channels
    const newUser = generateUsers(1)[0];
    const userId = newUser.userId;
    userRelationshipStorage.load(userId);
    channelStorage.loadUser(userId);
    const result = await service.findAllChannels(userId);
    const joinedChannels = channelMembersEntities
      .filter((channelMember) => channelMember.memberId === userId)
      .map((channelMember) =>
        channelsEntities.find((v) => v.channelId == channelMember.channelId),
      )
      .sort((a, b) => a.modifiedAt.valueOf() - b.modifiedAt.valueOf())
      .map((channel) => {
        return {
          channelId: channel.channelId,
          channelName: channel.name,
          isDm: channel.dmPeerId !== null,
          memberCount: channelStorage.getChannel(channel.channelId).userRoleMap
            .size,
          accessMode: channel.accessMode,
          unseenCount: channelStorage.getUser(userId).get(channel.channelId)
            .unseenCount,
        };
      });

    const filterSet = new Set();
    const otherChannels = channelMembersEntities
      .filter((channelMember) => {
        if (filterSet.has(channelMember.channelId)) {
          return false;
        }
        filterSet.add(channelMember.channelId);
        if (
          !channelStorage.getUser(userId).has(channelMember.channelId) &&
          channelsEntities.find((v) => v.channelId == channelMember.channelId)
            .accessMode !== 'private'
        )
          return true;
        return false;
      })
      .map((channelMember) => {
        return channelsEntities.find(
          (v) => v.channelId == channelMember.channelId,
        );
      })
      .map((channel) => {
        return {
          channelId: channel.channelId,
          channelName: channel.name,
          memberCount: channelStorage.getChannel(channel.channelId).userRoleMap
            .size,
          accessMode: channel.accessMode as 'public' | 'protected',
        };
      })
      .sort((a, b) => a.channelName.localeCompare(b.channelName));
    expect(result).toEqual({ joinedChannels, otherChannels });
  });

  it('should not be able to channel if there is no channel in server', async () => {
    jest.spyOn(channelStorage, 'getChannels').mockReturnValue(new Map());
    expect(await service.findAllChannels(usersEntities[0].userId)).toEqual({
      joinedChannels: [],
      otherChannels: [],
    });
  });

  it('should throw BadRequest exception when user not loaded', async () => {
    jest.spyOn(channelStorage, 'getUser').mockReturnValue(undefined);
    await expect(async () =>
      service.findAllChannels(usersEntities[0].userId),
    ).rejects.toThrow(BadRequestException);
  });

  it('should create new channel', async () => {
    const userId = usersEntities[0].userId;
    userRelationshipStorage.load(userId);
    channelStorage.loadUser(userId);
    const newChannelData: NewChannelDto = {
      channelName: 'newChannel',
      password: '1q2w3e4r',
      accessMode: 'protected',
    };
    const newChannelId = await service.createChannel(userId, newChannelData);
    expect(channelStorage.getUser(userId).has(newChannelId)).toBeTruthy();
    expect(channelStorage.getUserRole(newChannelId, userId)).toBe('owner');
    const newChannelInfo = channelStorage.getChannel(newChannelId);
    expect(newChannelInfo).toBeDefined();
    expect(newChannelInfo.userRoleMap.size).toBe(1);
    const [newChannel] = await dataSource
      .getRepository(Channels)
      .findBy({ channelId: newChannelId });
    expect(newChannel).toBeDefined();
    expect(newChannelInfo.accessMode).toBe(newChannel.accessMode);
    expect(newChannelInfo.modifiedAt).toEqual(newChannel.modifiedAt);
    expect(
      compare(newChannelData.password, newChannel.password.toString()),
    ).resolves.toBeTruthy();
  });
});
