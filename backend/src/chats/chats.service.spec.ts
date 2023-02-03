import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { DateTime } from 'luxon';
import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { compare } from 'bcrypt';

import { ActivityManager } from '../user-status/activity.manager';
import { BannedMembers } from '../entity/banned-members.entity';
import { ChannelMembers } from '../entity/channel-members.entity';
import { ChannelStorage } from '../user-status/channel.storage';
import { Channels } from '../entity/channels.entity';
import { ChatsGateway } from './chats.gateway';
import { ChatsModule } from './chats.module';
import { ChatsService } from './chats.service';
import { CreateChannelDto } from './dto/chats.dto';
import { Messages } from '../entity/messages.entity';
import {
  TYPEORM_SHARED_CONFIG,
  createDataSources,
  destroyDataSources,
} from '../../test/db-resource-manager';
import { UserRelationshipStorage } from '../user-status/user-relationship.storage';
import { UserStatusModule } from '../user-status/user-status.module';
import { Users } from '../entity/users.entity';
import {
  generateBannedMembers,
  generateChannelMembers,
  generateChannels,
  generateMessages,
  generateUsers,
} from '../../test/generate-mock-data';
import { ValidateNewChannelPipe } from './pipe/validate-new-channel.pipe';

const TEST_DB = 'test_db_chat_service';
const ENTITIES = [BannedMembers, ChannelMembers, Channels, Messages, Users];

describe('ChatsService', () => {
  let dataSource: DataSource;
  let initDataSource: DataSource;
  let service: ChatsService;
  let chatsGateway: ChatsGateway;
  let userRelationshipStorage: UserRelationshipStorage;
  let channelStorage: ChannelStorage;
  let usersEntities: Users[];
  let channelsEntities: Channels[];
  let channelMembersEntities: ChannelMembers[];
  let bannedMembersEntities: BannedMembers[];
  let activityManager: ActivityManager;

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
        TypeOrmModule.forFeature([Channels, BannedMembers, Messages]),
        ChatsModule,
      ],
      providers: [ChatsGateway, ChatsService],
    }).compile();

    module.init();
    service = module.get<ChatsService>(ChatsService);
    userRelationshipStorage = module.get<UserRelationshipStorage>(
      UserRelationshipStorage,
    );
    channelStorage = module.get<ChannelStorage>(ChannelStorage);
    chatsGateway = module.get<ChatsGateway>(ChatsGateway);
    for (const u of usersEntities) {
      await userRelationshipStorage.load(u.userId);
      await channelStorage.loadUser(u.userId);
    }
    activityManager = module.get<ActivityManager>(ActivityManager);
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
      let newChannelData: CreateChannelDto = {
        channelName: 'newChannel',
        password: '1q2w3e4r',
        accessMode: 'protected',
      };
      newChannelData = await new ValidateNewChannelPipe().transform(
        newChannelData,
      );
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
        compare('1q2w3e4r', newChannel.password.toString()),
      ).resolves.toBeTruthy();
    });

    it('should not create new channel if no password given when protected room', async () => {
      const newChannelData: CreateChannelDto = {
        channelName: 'newChannel',
        accessMode: 'protected',
      };
      expect(
        async () =>
          await new ValidateNewChannelPipe().transform(newChannelData),
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
      expect(service.findChannelMembers(channelId, memberData[0].id)).toEqual({
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
      expect(service.findChannelMembers(channelId, memberData[0].id)).toEqual({
        channelMembers: memberData,
        isReadonlyDm: userRelationshipStorage.isBlockedDm(channelId),
      });
    });

    it('should throw Not Found exception when channel not found', () => {
      expect(() =>
        service.findChannelMembers(424242, usersEntities[0].userId),
      ).toThrow(NotFoundException);
    });

    it('should throw Forbidden exception when a user is not member of the channel', async () => {
      const channel = channelsEntities.find((v) => v.dmPeerId === null);
      const channelId = channel.channelId;
      const channelMemberIds = channelMembersEntities
        .filter((v) => v.channelId === channelId)
        .map((v) => v.memberId);
      const nonChannelMember = usersEntities.find(
        (v) => !channelMemberIds.includes(v.userId),
      );
      if (!nonChannelMember) {
        return console.log('FIND NON CHANNEL MEMBER TEST SKIPPED!!!');
      }
      const nonChannelMemberId = nonChannelMember.userId;
      expect(() =>
        service.findChannelMembers(channelId, nonChannelMemberId),
      ).toThrow(ForbiddenException);
    });
  });

  describe('joinChannel', () => {
    let memberJoinSpy: jest.SpyInstance;
    beforeEach(() => {
      memberJoinSpy = jest
        .spyOn(chatsGateway, 'emitMemberJoin')
        .mockImplementation(() => undefined);
    });
    it('should join user to the public channel', async () => {
      const userId = usersEntities[0].userId;
      let newChannelData: CreateChannelDto = {
        channelName: 'newChannel',
        accessMode: 'public',
      };
      newChannelData = await new ValidateNewChannelPipe().transform(
        newChannelData,
      );
      const newChannelId = await service.createChannel(userId, newChannelData);
      const anotherUserId = usersEntities[1].userId;
      await service.joinChannel(newChannelId, anotherUserId, false);
      expect(
        channelStorage.getUser(anotherUserId).has(newChannelId),
      ).toBeTruthy();
      expect(memberJoinSpy).toBeCalledWith(anotherUserId, newChannelId);

      expect(channelStorage.getUserRole(newChannelId, anotherUserId)).toBe(
        'member',
      );
    });

    it('should join user to the protected channel', async () => {
      const userId = usersEntities[0].userId;
      let newChannelData: CreateChannelDto = {
        channelName: 'newChannel',
        password: '1q2w3e4r',
        accessMode: 'protected',
      };
      newChannelData = await new ValidateNewChannelPipe().transform(
        newChannelData,
      );
      const newChannelId = await service.createChannel(userId, newChannelData);
      const anotherUserId = usersEntities[1].userId;
      await service.joinChannel(newChannelId, anotherUserId, false, '1q2w3e4r');
      expect(
        channelStorage.getUser(anotherUserId).has(newChannelId),
      ).toBeTruthy();
      expect(memberJoinSpy).toBeCalledWith(anotherUserId, newChannelId);

      expect(channelStorage.getUserRole(newChannelId, anotherUserId)).toBe(
        'member',
      );
    });

    it('should throw when user attempt to join the protected channel with incorrect or no password', async () => {
      const userId = usersEntities[0].userId;
      let newChannelData: CreateChannelDto = {
        channelName: 'newChannel2',
        password: 'trickyPassword',
        accessMode: 'protected',
      };
      newChannelData = await new ValidateNewChannelPipe().transform(
        newChannelData,
      );
      const newChannelId = await service.createChannel(userId, newChannelData);
      const anotherUserId = usersEntities[1].userId;
      expect(async () =>
        service.joinChannel(newChannelId, anotherUserId, false, '1q2w3e4r'),
      ).rejects.toThrow(ForbiddenException);
      expect(async () =>
        service.joinChannel(newChannelId, anotherUserId, false),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should add user to the protected channel by invitation without password ', async () => {
      const userId = usersEntities[0].userId;
      let newChannelData: CreateChannelDto = {
        channelName: 'newChannel',
        password: 'password',
        accessMode: 'protected',
      };
      newChannelData = await new ValidateNewChannelPipe().transform(
        newChannelData,
      );
      const newChannelId = await service.createChannel(userId, newChannelData);
      const anotherUserId = usersEntities[1].userId;
      await service.joinChannel(newChannelId, anotherUserId, true);
      expect(
        channelStorage.getUser(anotherUserId).has(newChannelId),
      ).toBeTruthy();
      expect(memberJoinSpy).toBeCalledWith(anotherUserId, newChannelId);

      expect(channelStorage.getUserRole(newChannelId, anotherUserId)).toBe(
        'member',
      );
    });

    it('should not add user to the private channel', async () => {
      const userId = usersEntities[0].userId;
      let newChannelData: CreateChannelDto = {
        channelName: 'newChannel',
        accessMode: 'private',
      };
      newChannelData = await new ValidateNewChannelPipe().transform(
        newChannelData,
      );
      const newChannelId = await service.createChannel(userId, newChannelData);
      const anotherUserId = usersEntities[1].userId;
      expect(async () =>
        service.joinChannel(newChannelId, anotherUserId, false),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should add user to the private channel by invitation', async () => {
      const userId = usersEntities[0].userId;
      let newChannelData: CreateChannelDto = {
        channelName: 'newChannel',
        accessMode: 'private',
      };
      newChannelData = await new ValidateNewChannelPipe().transform(
        newChannelData,
      );
      const newChannelId = await service.createChannel(userId, newChannelData);
      const anotherUserId = usersEntities[1].userId;
      await service.joinChannel(newChannelId, anotherUserId, true);
      expect(
        channelStorage.getUser(anotherUserId).has(newChannelId),
      ).toBeTruthy();
      expect(memberJoinSpy).toBeCalledWith(anotherUserId, newChannelId);

      expect(channelStorage.getUserRole(newChannelId, anotherUserId)).toBe(
        'member',
      );
    });

    it('should not add banned user to the channel', async () => {
      const userId = usersEntities[0].userId;
      let newChannelData: CreateChannelDto = {
        channelName: 'newChannel',
        accessMode: 'public',
      };
      newChannelData = await new ValidateNewChannelPipe().transform(
        newChannelData,
      );
      const newChannelId = await service.createChannel(userId, newChannelData);
      const anotherUserId = usersEntities[1].userId;
      await dataSource.getRepository(BannedMembers).insert({
        channelId: newChannelId,
        memberId: anotherUserId,
        endAt: DateTime.now().plus({ days: 1 }),
      });
      expect(async () =>
        service.joinChannel(newChannelId, anotherUserId, true),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('leaveChannel', () => {
    let memberLeftSpy: jest.SpyInstance;
    beforeEach(() => {
      jest
        .spyOn(chatsGateway, 'emitMemberJoin')
        .mockImplementation(() => undefined);
      memberLeftSpy = jest
        .spyOn(chatsGateway, 'emitMemberLeft')
        .mockImplementation(() => undefined);
    });
    it('should leave channel (not owner)', async () => {
      const userId = usersEntities[0].userId;
      let newChannelData: CreateChannelDto = {
        channelName: 'newChannel',
        password: 'password',
        accessMode: 'protected',
      };
      newChannelData = await new ValidateNewChannelPipe().transform(
        newChannelData,
      );
      const newChannelId = await service.createChannel(userId, newChannelData);
      const anotherUserId = usersEntities[1].userId;
      await service.joinChannel(newChannelId, anotherUserId, true);

      await service.leaveChannel(newChannelId, anotherUserId);
      expect(
        channelStorage.getUser(anotherUserId).has(newChannelId),
      ).toBeFalsy();
      expect(memberLeftSpy).toBeCalledWith(anotherUserId, newChannelId, false);

      expect(
        channelStorage.getUserRole(newChannelId, anotherUserId),
      ).toBeFalsy();
    });

    it('should leave channel (owner)', async () => {
      const userId = usersEntities[0].userId;
      let newChannelData: CreateChannelDto = {
        channelName: 'newChannel2',
        password: 'trickyPassword',
        accessMode: 'protected',
      };
      newChannelData = await new ValidateNewChannelPipe().transform(
        newChannelData,
      );
      const newChannelId = await service.createChannel(userId, newChannelData);
      const anotherUserId = usersEntities[1].userId;
      await service.joinChannel(newChannelId, anotherUserId, true);
      await service.leaveChannel(newChannelId, userId);
      expect(channelStorage.getChannel(newChannelId)).toBeFalsy();
      expect(channelStorage.getUserRole(newChannelId, userId)).toBeFalsy();
      expect(
        channelStorage.getUserRole(newChannelId, anotherUserId),
      ).toBeFalsy();
    });

    it('should leave channel (owner, already existed channel)', async () => {
      const targetChannel = channelsEntities[7];
      const userId = targetChannel.ownerId;
      let newChannelData: CreateChannelDto = {
        channelName: 'newChannel2',
        password: 'trickyPassword',
        accessMode: 'protected',
      };
      newChannelData = await new ValidateNewChannelPipe().transform(
        newChannelData,
      );
      const newChannelId = await service.createChannel(userId, newChannelData);
      const anotherUserId = usersEntities[1].userId;
      await service.joinChannel(newChannelId, anotherUserId, true);
      await service.leaveChannel(newChannelId, userId);
      expect(channelStorage.getChannel(newChannelId)).toBeFalsy();
      expect(channelStorage.getUserRole(newChannelId, userId)).toBeFalsy();
      expect(
        channelStorage.getUserRole(newChannelId, anotherUserId),
      ).toBeFalsy();
      expect(
        await dataSource
          .getRepository(Messages)
          .findBy({ channelId: newChannelId }),
      ).toHaveLength(0);
    });
  });

  describe('findChannelMessages', () => {
    it('should find messages (offset, size) in channel order by createdAt', async () => {
      const channelId = Array.from(channelStorage.getChannels()).find(
        (v) => v[1].userRoleMap.size > 3,
      )[0];
      const [userId] = channelStorage
        .getChannels()
        .get(channelId)
        .userRoleMap.keys();
      if (!channelId) {
        return console.log('FIND CHANNEL MESSAGES TEST SKIPPED!!!');
      }
      const messages = generateMessages(
        channelMembersEntities.filter((v) => v.channelId === channelId),
      );
      await dataSource.getRepository(Messages).insert(messages);
      const messagesDto = messages
        .sort((a, b) => a.createdAt.valueOf() - b.createdAt.valueOf())
        .map((v) => {
          const { createdAt, contents, senderId } = v;
          return { senderId, contents, createdAt: createdAt.toMillis() };
        });
      const ret = await service.findChannelMessages(channelId, userId, 0, 3);
      expect(ret).toEqual({ messages: [...messagesDto.slice(0, 3)] });
      await dataSource.getRepository(Messages).remove(messages);
    });

    it('should find messages (offset, size) even the size is bigger than the number of messages', async () => {
      const channelId = Array.from(channelStorage.getChannels()).find(
        (v) => v[1].userRoleMap.size > 3,
      )[0];
      if (channelId === undefined) {
        return console.log(
          'FIND CHANNEL MESSAGES WITT MAX SIZE TEST SKIPPED!!!',
        );
      }
      const [userId] = channelStorage
        .getChannels()
        .get(channelId)
        .userRoleMap.keys();
      const messages = generateMessages(
        channelMembersEntities.filter((v) => v.channelId === channelId),
      );
      await dataSource.getRepository(Messages).insert(messages);
      const messagesDto = messages
        .sort((a, b) => a.createdAt.valueOf() - b.createdAt.valueOf())
        .map((v) => {
          const { createdAt, contents, senderId } = v;
          return { senderId, contents, createdAt: createdAt.toMillis() };
        });
      const ret = await service.findChannelMessages(
        channelId,
        userId,
        0,
        // BigInt('9223372036854775806') javascript change the number to 9223372036854766000
        21474836499923,
      );
      expect(ret).toEqual({ messages: [...messagesDto] });
      await dataSource.getRepository(Messages).remove(messages);
    });

    it('should not find messages (offset, size) if the offset is bigger than the number of messages', async () => {
      const channelId = Array.from(channelStorage.getChannels()).find(
        (v) => v[1].userRoleMap.size > 3,
      )[0];
      const [userId] = channelStorage
        .getChannels()
        .get(channelId)
        .userRoleMap.keys();
      if (!channelId) {
        return console.log(
          'FIND CHANNEL MESSAGES WITH BIG OFFSET TEST SKIPPED!!!',
        );
      }
      const messages = generateMessages(
        channelMembersEntities.filter((v) => v.channelId === channelId),
      );
      await dataSource.getRepository(Messages).insert(messages);
      const ret = await service.findChannelMessages(
        channelId,
        userId,
        99999999999999,
        3,
      );
      expect(ret).toEqual({ messages: [] });
      await dataSource.getRepository(Messages).remove(messages);
    });
  });

  describe('manageMessage (createMessage & executeCommand)', () => {
    let newMessageSpy: jest.SpyInstance;
    let memberLeftSpy: jest.SpyInstance;
    let roleChangedSpy: jest.SpyInstance;
    let mutedSpy: jest.SpyInstance;
    let messageArrivedSpy: jest.SpyInstance;
    beforeEach(() => {
      newMessageSpy = jest
        .spyOn(chatsGateway, 'emitNewMessage')
        .mockImplementation((userId, channelId) => {
          chatsGateway.emitMessageArrived(channelId);
        });

      memberLeftSpy = jest
        .spyOn(chatsGateway, 'emitMemberLeft')
        .mockImplementation(() => undefined);

      roleChangedSpy = jest
        .spyOn(chatsGateway, 'emitRoleChanged')
        .mockImplementation(() => undefined);

      mutedSpy = jest
        .spyOn(chatsGateway, 'emitMuted')
        .mockImplementation(() => undefined);
      messageArrivedSpy = jest
        .spyOn(chatsGateway, 'emitMessageArrived')
        .mockImplementation(() => undefined);
      jest
        .spyOn(chatsGateway, 'emitMemberJoin')
        .mockImplementation(() => undefined);
    });

    it('should create message and then notify new message arrived', async () => {
      const userId = usersEntities[1].userId;
      let newChannelData: CreateChannelDto = {
        channelName: 'newChannel',
        accessMode: 'private',
      };
      newChannelData = await new ValidateNewChannelPipe().transform(
        newChannelData,
      );
      const newChannelId = await service.createChannel(userId, newChannelData);
      const anotherUserId = usersEntities[2].userId;
      activityManager.setActivity(userId, `chatRooms-${newChannelId}`);
      activityManager.setActivity(anotherUserId, 'profile');

      await service.joinChannel(newChannelId, anotherUserId, true);
      const msg = { message: 'hello message!' };
      await service.controlMessage(newChannelId, userId, msg.message);
      expect(newMessageSpy).toBeCalledWith(
        userId,
        newChannelId,
        msg.message,
        expect.any(DateTime),
      );
      expect(messageArrivedSpy).toBeCalledWith(newChannelId);
      expect(channelStorage.getUser(userId).get(newChannelId).unseenCount).toBe(
        0,
      );
      expect(
        channelStorage.getUser(anotherUserId).get(newChannelId).unseenCount,
      ).toBe(1);
      expect(
        await dataSource
          .getRepository(Messages)
          .findOneBy({ channelId: newChannelId }),
      ).toEqual({
        messageId: expect.any(Number),
        channelId: newChannelId,
        contents: msg.message,
        createdAt: expect.any(DateTime),
        senderId: userId,
      });
    });

    it('should not create message when muted user sends message', async () => {
      // user create channel and send message
      // another user is already loaded and join the channel
      const userId = usersEntities[1].userId;
      let newChannelData: CreateChannelDto = {
        channelName: 'newChannel',
        accessMode: 'private',
      };
      newChannelData = await new ValidateNewChannelPipe().transform(
        newChannelData,
      );
      const newChannelId = await service.createChannel(userId, newChannelData);
      const anotherUserId = usersEntities[2].userId;
      activityManager.setActivity(userId, `chatRooms-${newChannelId}`);
      activityManager.setActivity(anotherUserId, `chatRooms-${newChannelId}`);

      await service.joinChannel(newChannelId, anotherUserId, true);
      const msg = { message: 'hello message!' };
      await channelStorage.updateMuteStatus(
        newChannelId,
        userId,
        anotherUserId,
        DateTime.now().plus({ days: 1 }),
      );
      expect(
        async () =>
          await service.controlMessage(
            newChannelId,
            anotherUserId,
            msg.message,
          ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should execute role command (executor : owner)', async () => {
      const ownerId = usersEntities[1].userId;
      let newChannelData: CreateChannelDto = {
        channelName: 'newChannel',
        accessMode: 'private',
      };
      newChannelData = await new ValidateNewChannelPipe().transform(
        newChannelData,
      );
      const newChannelId = await service.createChannel(ownerId, newChannelData);
      const anotherUserId = usersEntities[2].userId;

      await service.joinChannel(newChannelId, anotherUserId, true);
      let msg = { message: `/role ${anotherUserId} admin` };
      await service.controlMessage(newChannelId, ownerId, msg.message);
      expect(channelStorage.getUserRole(newChannelId, anotherUserId)).toBe(
        'admin',
      );
      expect(roleChangedSpy).toBeCalledWith(
        anotherUserId,
        newChannelId,
        'admin',
      );
      msg = { message: `/role ${anotherUserId} member` };
      await service.controlMessage(newChannelId, ownerId, msg.message);
      expect(channelStorage.getUserRole(newChannelId, anotherUserId)).toBe(
        'member',
      );
      expect(roleChangedSpy).toBeCalledWith(
        anotherUserId,
        newChannelId,
        'member',
      );
    });

    it('should execute role command (executor : owner & admin)', async () => {
      const ownerId = usersEntities[1].userId;
      let newChannelData: CreateChannelDto = {
        channelName: 'newChannel',
        accessMode: 'private',
      };
      newChannelData = await new ValidateNewChannelPipe().transform(
        newChannelData,
      );
      const newChannelId = await service.createChannel(ownerId, newChannelData);
      const memberId = usersEntities[2].userId;
      const adminId = usersEntities[3].userId;

      await service.joinChannel(newChannelId, adminId, true);
      await service.joinChannel(newChannelId, memberId, true);

      let msg = { message: `/role ${adminId} admin` };
      await service.controlMessage(newChannelId, ownerId, msg.message);
      expect(channelStorage.getUserRole(newChannelId, adminId)).toBe('admin');
      expect(roleChangedSpy).toBeCalledWith(adminId, newChannelId, 'admin');

      msg = { message: `/role ${memberId} admin` };
      await service.controlMessage(newChannelId, adminId, msg.message);
      expect(channelStorage.getUserRole(newChannelId, memberId)).toBe('admin');
      expect(roleChangedSpy).toBeCalledWith(memberId, newChannelId, 'admin');
    });

    it('should not execute role command (executor : member)', async () => {
      const ownerId = usersEntities[1].userId;
      let newChannelData: CreateChannelDto = {
        channelName: 'newChannel',
        accessMode: 'private',
      };
      newChannelData = await new ValidateNewChannelPipe().transform(
        newChannelData,
      );
      const newChannelId = await service.createChannel(ownerId, newChannelData);
      const memberId = usersEntities[2].userId;
      const adminId = usersEntities[3].userId;

      await service.joinChannel(newChannelId, adminId, true);
      await service.joinChannel(newChannelId, memberId, true);

      let msg = { message: `/role ${adminId} admin` };
      await service.controlMessage(newChannelId, ownerId, msg.message);
      expect(channelStorage.getUserRole(newChannelId, adminId)).toBe('admin');
      expect(roleChangedSpy).toBeCalledWith(adminId, newChannelId, 'admin');

      msg = { message: `/role ${adminId} member` };
      expect(
        async () =>
          await service.controlMessage(newChannelId, memberId, msg.message),
      ).rejects.toThrow(ForbiddenException);

      msg = { message: `/role ${adminId} owner` };
      expect(
        async () =>
          await service.controlMessage(newChannelId, memberId, msg.message),
      ).rejects.toThrow(BadRequestException);

      msg = { message: `/role ${ownerId} admin` };
      expect(
        async () =>
          await service.controlMessage(newChannelId, memberId, msg.message),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw if a user attempt to execute command with invalid permission (member -> owner) ', async () => {
      const ownerId = usersEntities[1].userId;
      let newChannelData: CreateChannelDto = {
        channelName: 'newChannel',
        accessMode: 'private',
      };
      newChannelData = await new ValidateNewChannelPipe().transform(
        newChannelData,
      );
      const newChannelId = await service.createChannel(ownerId, newChannelData);
      const anotherUserId = usersEntities[2].userId;
      await service.joinChannel(newChannelId, anotherUserId, true);
      const msg = { message: `/role ${ownerId} admin` };
      expect(
        async () =>
          await service.controlMessage(
            newChannelId,
            anotherUserId,
            msg.message,
          ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw if attempt to execute command with invalid permission (admin -> owner) ', async () => {
      const ownerId = usersEntities[1].userId;
      let newChannelData: CreateChannelDto = {
        channelName: 'newChannel',
        accessMode: 'private',
      };
      newChannelData = await new ValidateNewChannelPipe().transform(
        newChannelData,
      );
      const newChannelId = await service.createChannel(ownerId, newChannelData);
      const anotherUserId = usersEntities[2].userId;
      await service.joinChannel(newChannelId, anotherUserId, true);
      let msg = { message: `/role ${ownerId} admin` };
      expect(
        async () =>
          await service.controlMessage(
            newChannelId,
            anotherUserId,
            msg.message,
          ),
      ).rejects.toThrow(ForbiddenException);
      msg = { message: `/ban ${ownerId} 42` };
      expect(
        async () =>
          await service.controlMessage(
            newChannelId,
            anotherUserId,
            msg.message,
          ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should execute mute command (admin -> member)', async () => {
      const ownerId = usersEntities[1].userId;
      let newChannelData: CreateChannelDto = {
        channelName: 'newChannel',
        accessMode: 'private',
      };
      newChannelData = await new ValidateNewChannelPipe().transform(
        newChannelData,
      );
      const newChannelId = await service.createChannel(ownerId, newChannelData);
      const memberId = usersEntities[2].userId;
      const adminId = usersEntities[3].userId;

      await service.joinChannel(newChannelId, adminId, true);
      await service.joinChannel(newChannelId, memberId, true);

      let msg = { message: `/role ${adminId} admin` };
      await service.controlMessage(newChannelId, ownerId, msg.message);
      expect(channelStorage.getUserRole(newChannelId, adminId)).toBe('admin');
      expect(roleChangedSpy).toBeCalledWith(adminId, newChannelId, 'admin');

      msg = { message: `/mute ${memberId} 5` };
      await service.controlMessage(newChannelId, ownerId, msg.message);
      expect(
        Math.round(
          DateTime.now()
            .diff(
              channelStorage.getUser(memberId).get(newChannelId)
                .muteEndAt as DateTime,
              ['minutes'],
            )
            .toObject().minutes,
        ),
      ).toBe(-5);
      expect(mutedSpy).toBeCalledWith(
        memberId,
        newChannelId,
        expect.any(DateTime),
      );
    });

    it('should not execute mute command if given time is invalid', async () => {
      const ownerId = usersEntities[1].userId;
      let newChannelData: CreateChannelDto = {
        channelName: 'newChannel',
        accessMode: 'private',
      };
      newChannelData = await new ValidateNewChannelPipe().transform(
        newChannelData,
      );
      const newChannelId = await service.createChannel(ownerId, newChannelData);
      const memberId = usersEntities[2].userId;
      const adminId = usersEntities[3].userId;

      await service.joinChannel(newChannelId, adminId, true);
      await service.joinChannel(newChannelId, memberId, true);

      let msg = { message: `/role ${adminId} admin` };
      await service.controlMessage(newChannelId, ownerId, msg.message);
      expect(channelStorage.getUserRole(newChannelId, adminId)).toBe('admin');
      expect(roleChangedSpy).toBeCalledWith(adminId, newChannelId, 'admin');

      msg = { message: `/mute ${memberId} -5` };
      expect(
        async () =>
          await service.controlMessage(newChannelId, ownerId, msg.message),
      ).rejects.toThrow(BadRequestException);
    });

    it('should not execute mute command (admin -> owner)', async () => {
      const ownerId = usersEntities[1].userId;
      let newChannelData: CreateChannelDto = {
        channelName: 'newChannel',
        accessMode: 'private',
      };
      newChannelData = await new ValidateNewChannelPipe().transform(
        newChannelData,
      );
      const newChannelId = await service.createChannel(ownerId, newChannelData);
      const memberId = usersEntities[2].userId;
      const adminId = usersEntities[3].userId;

      await service.joinChannel(newChannelId, adminId, true);
      await service.joinChannel(newChannelId, memberId, true);

      let msg = { message: `/role ${adminId} admin` };
      await service.controlMessage(newChannelId, ownerId, msg.message);
      expect(channelStorage.getUserRole(newChannelId, adminId)).toBe('admin');
      expect(roleChangedSpy).toBeCalledWith(adminId, newChannelId, 'admin');

      msg = { message: `/mute ${ownerId} 5` };
      expect(
        async () =>
          await service.controlMessage(newChannelId, adminId, msg.message),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should execute ban command (admin -> member)', async () => {
      const ownerId = usersEntities[1].userId;
      let newChannelData: CreateChannelDto = {
        channelName: 'newChannel',
        accessMode: 'private',
      };
      newChannelData = await new ValidateNewChannelPipe().transform(
        newChannelData,
      );
      const newChannelId = await service.createChannel(ownerId, newChannelData);
      const memberId = usersEntities[2].userId;
      const adminId = usersEntities[3].userId;

      await service.joinChannel(newChannelId, adminId, true);
      await service.joinChannel(newChannelId, memberId, true);

      let msg = { message: `/role ${adminId} admin` };
      await service.controlMessage(newChannelId, ownerId, msg.message);
      expect(channelStorage.getUserRole(newChannelId, adminId)).toBe('admin');
      expect(roleChangedSpy).toBeCalledWith(adminId, newChannelId, 'admin');

      msg = { message: `/ban ${memberId} 5` };
      await service.controlMessage(newChannelId, adminId, msg.message);
      expect(
        Math.round(
          DateTime.now()
            .diff(await channelStorage.getBanEndAt(newChannelId, memberId), [
              'minutes',
            ])
            .toObject().minutes,
        ),
      ).toBe(-5);

      expect(memberLeftSpy).toBeCalledWith(memberId, newChannelId, false);
      expect(
        async () => await service.joinChannel(newChannelId, memberId, true),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw when command is out of form', async () => {
      const ownerId = usersEntities[1].userId;
      let newChannelData: CreateChannelDto = {
        channelName: 'newChannel',
        accessMode: 'private',
      };
      newChannelData = await new ValidateNewChannelPipe().transform(
        newChannelData,
      );
      const newChannelId = await service.createChannel(ownerId, newChannelData);
      const memberId = usersEntities[2].userId;
      const adminId = usersEntities[3].userId;

      await service.joinChannel(newChannelId, ownerId, true);
      await service.joinChannel(newChannelId, memberId, true);

      const msg = { message: `/ba ${adminId} admin` };
      expect(
        async () =>
          await service.controlMessage(newChannelId, ownerId, msg.message),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
