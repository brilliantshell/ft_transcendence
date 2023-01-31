import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
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
import { DateTime } from 'luxon';

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
          poolSize: 3,
        }),
        TypeOrmModule.forFeature([Channels, BannedMembers]),
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

  describe('findAllChannels', () => {
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
            memberCount: channelStorage.getChannel(channel.channelId)
              .userRoleMap.size,
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
            memberCount: channelStorage.getChannel(channel.channelId)
              .userRoleMap.size,
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
      await userRelationshipStorage.load(userId);
      await channelStorage.loadUser(userId);
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
            memberCount: channelStorage.getChannel(channel.channelId)
              .userRoleMap.size,
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
            memberCount: channelStorage.getChannel(channel.channelId)
              .userRoleMap.size,
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
  });

  describe('createChannel', () => {
    it('should create new channel', async () => {
      const userId = usersEntities[0].userId;
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

    it('should not create new channel if no password given when protected room', async () => {
      const userId = usersEntities[0].userId;
      const newChannelData: NewChannelDto = {
        channelName: 'newChannel',
        accessMode: 'protected',
      };
      expect(async () =>
        service.createChannel(userId, newChannelData),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('findChannelMembers', () => {
    it('should find channel members (not DM)', async () => {
      const channelId = channelsEntities.find(
        (v) => v.dmPeerId === null,
      ).channelId;
      const channelMembers = channelMembersEntities.filter(
        (v) => v.channelId === channelId,
      );
      const memberData = channelMembers.map((v) => {
        return {
          id: v.memberId,
          role: channelStorage
            .getChannel(channelId)
            .userRoleMap.get(v.memberId),
        };
      });
      expect(service.findChannelMembers(memberData[0].id, channelId)).toEqual({
        channelMembers: memberData,
        isReadonlyDm: null,
      });
    });

    it('should find channel members (DM)', async () => {
      const channel = channelsEntities.find((v) => v.dmPeerId !== null);
      if (!channel) {
        return console.log('FIND DM CHANNEL MEMBER TEST SKIPPED!!!');
      }
      const { ownerId, channelId, dmPeerId } = channel;
      const memberData = [ownerId, dmPeerId].map((id) => {
        return {
          id,
          role: channelStorage.getChannel(channelId).userRoleMap.get(id),
        };
      });
      expect(service.findChannelMembers(memberData[0].id, channelId)).toEqual({
        channelMembers: memberData,
        isReadonlyDm: userRelationshipStorage.isBlockedDm(channelId),
      });
    });

    it('should throw Not Found exception when channel not found', () => {
      expect(() =>
        service.findChannelMembers(usersEntities[0].userId, 424242),
      ).toThrow(NotFoundException);
    });

    it('should throw Forbidden exception when a user is not member of the channel', async () => {
      const channelId = channelsEntities.find(
        (v) => v.dmPeerId === null,
      ).channelId;
      const [nonChannelMember] = channelMembersEntities.filter(
        (v) => v.channelId !== channelId,
      );
      expect(() =>
        service.findChannelMembers(nonChannelMember.memberId, channelId),
      ).toThrow(ForbiddenException);
    });
  });

  describe('joinChannel', () => {
    it('should join user to the public channel', async () => {
      const userId = usersEntities[0].userId;
      const newChannelData: NewChannelDto = {
        channelName: 'newChannel',
        accessMode: 'public',
      };
      const newChannelId = await service.createChannel(userId, newChannelData);

      const anotherUserId = usersEntities[1].userId;
      await service.joinChannel(anotherUserId, newChannelId, false);
      expect(
        channelStorage.getUser(anotherUserId).has(newChannelId),
      ).toBeTruthy();

      expect(channelStorage.getUserRole(newChannelId, anotherUserId)).toBe(
        'member',
      );
    });

    it('should join user to the protected channel', async () => {
      const userId = usersEntities[0].userId;
      const newChannelData: NewChannelDto = {
        channelName: 'newChannel',
        password: '1q2w3e4r',
        accessMode: 'protected',
      };
      const newChannelId = await service.createChannel(userId, newChannelData);

      const anotherUserId = usersEntities[1].userId;
      await service.joinChannel(anotherUserId, newChannelId, false, '1q2w3e4r');
      expect(
        channelStorage.getUser(anotherUserId).has(newChannelId),
      ).toBeTruthy();

      expect(channelStorage.getUserRole(newChannelId, anotherUserId)).toBe(
        'member',
      );
    });

    it('should throw when user attempt to join the protected channel with incorrect or no password', async () => {
      const userId = usersEntities[0].userId;
      const newChannelData: NewChannelDto = {
        channelName: 'newChannel2',
        password: 'trickyPassword',
        accessMode: 'protected',
      };
      const newChannelId = await service.createChannel(userId, newChannelData);

      const anotherUserId = usersEntities[1].userId;
      expect(async () =>
        service.joinChannel(anotherUserId, newChannelId, false, '1q2w3e4r'),
      ).rejects.toThrow(ForbiddenException);
      expect(async () =>
        service.joinChannel(anotherUserId, newChannelId, false),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should add user to the protected channel by invitation without password ', async () => {
      const userId = usersEntities[0].userId;
      const newChannelData: NewChannelDto = {
        channelName: 'newChannel',
        password: 'password',
        accessMode: 'protected',
      };
      const newChannelId = await service.createChannel(userId, newChannelData);

      const anotherUserId = usersEntities[1].userId;
      await service.joinChannel(anotherUserId, newChannelId, true);
      expect(
        channelStorage.getUser(anotherUserId).has(newChannelId),
      ).toBeTruthy();

      expect(channelStorage.getUserRole(newChannelId, anotherUserId)).toBe(
        'member',
      );
    });

    it('should not add user to the private channel', async () => {
      const userId = usersEntities[0].userId;
      const newChannelData: NewChannelDto = {
        channelName: 'newChannel',
        accessMode: 'private',
      };
      const newChannelId = await service.createChannel(userId, newChannelData);

      const anotherUserId = usersEntities[1].userId;
      expect(async () =>
        service.joinChannel(anotherUserId, newChannelId, false),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should add user to the private channel by invitation', async () => {
      const userId = usersEntities[0].userId;
      const newChannelData: NewChannelDto = {
        channelName: 'newChannel',
        accessMode: 'private',
      };
      const newChannelId = await service.createChannel(userId, newChannelData);

      const anotherUserId = usersEntities[1].userId;
      await service.joinChannel(anotherUserId, newChannelId, true);
      expect(
        channelStorage.getUser(anotherUserId).has(newChannelId),
      ).toBeTruthy();

      expect(channelStorage.getUserRole(newChannelId, anotherUserId)).toBe(
        'member',
      );
    });

    it('should not add banned user to the channel', async () => {
      const userId = usersEntities[0].userId;
      const newChannelData: NewChannelDto = {
        channelName: 'newChannel',
        accessMode: 'public',
      };
      const newChannelId = await service.createChannel(userId, newChannelData);

      const anotherUserId = usersEntities[1].userId;
      await dataSource.getRepository(BannedMembers).insert({
        channelId: newChannelId,
        memberId: anotherUserId,
        endAt: DateTime.now().plus({ days: 1 }),
      });
      expect(async () =>
        service.joinChannel(anotherUserId, newChannelId, true),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // describe('DM Readonly', () => {
  //   it('should set DM readonly', async () => {});
  // });
});
