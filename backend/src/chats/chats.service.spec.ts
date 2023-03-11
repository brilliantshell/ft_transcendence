import { BadRequestException, ForbiddenException } from '@nestjs/common';
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
import { CreateChannelDto, UpdateChannelDto } from './dto/chats.dto';
import { Messages } from '../entity/messages.entity';
import {
  TYPEORM_SHARED_CONFIG,
  createDataSources,
  destroyDataSources,
} from '../../test/util/db-resource-manager';
import { UserRelationshipStorage } from '../user-status/user-relationship.storage';
import { UserStatusModule } from '../user-status/user-status.module';
import { Users } from '../entity/users.entity';
import {
  generateBannedMembers,
  generateChannelMembers,
  generateChannels,
  generateMessages,
  generateUsers,
} from '../../test/util/generate-mock-data';
import { ValidateChannelInfoPipe } from './pipe/validate-channel-info.pipe';

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
    usersEntities = generateUsers(50);
    channelsEntities = generateChannels(usersEntities);
    channelsEntities
      .filter((_, index) => index & 1)
      .forEach((c) => (c.name = generateRandomKorean(c.name.length)));
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
        .sort((a, b) => b.modifiedAt.valueOf() - a.modifiedAt.valueOf())
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
        .sort((a, b) =>
          new Intl.Collator('ko').compare(a.channelName, b.channelName),
        );
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
        .sort((a, b) =>
          new Intl.Collator('ko').compare(a.channelName, b.channelName),
        );
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
    let channelCreatedSpy: jest.SpyInstance;
    let joinChannelRoomSpy: jest.SpyInstance;
    beforeEach(() => {
      channelCreatedSpy = jest
        .spyOn(chatsGateway, 'emitChannelCreated')
        .mockImplementation(() => undefined);
      joinChannelRoomSpy = jest
        .spyOn(chatsGateway, 'joinChannelRoom')
        .mockImplementation(() => undefined);
    });
    it('should create new channel', async () => {
      const userId = usersEntities[0].userId;
      let newChannelData: CreateChannelDto = {
        channelName: 'newChannel',
        password: '1q2w3e4r',
        accessMode: 'protected',
      };
      newChannelData = (await new ValidateChannelInfoPipe().transform(
        newChannelData,
      )) as CreateChannelDto;
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
      expect(channelCreatedSpy).toBeCalledWith(
        newChannel.channelId,
        newChannel.name,
        newChannel.accessMode,
      );
      expect(joinChannelRoomSpy).toBeCalledWith(newChannel.channelId, userId);
    });

    it('should not create new channel if no password given when protected room', async () => {
      const newChannelData: CreateChannelDto = {
        channelName: 'newChannel',
        accessMode: 'protected',
      };
      expect(
        async () =>
          await new ValidateChannelInfoPipe().transform(newChannelData),
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
      expect(service.findChannelMembers(channelId)).toEqual({
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
      expect(service.findChannelMembers(channelId)).toEqual({
        channelMembers: memberData,
        isReadonlyDm: userRelationshipStorage.isBlockedDm(channelId),
      });
    });
  });

  describe('joinChannel', () => {
    let memberJoinSpy: jest.SpyInstance;
    beforeEach(() => {
      memberJoinSpy = jest
        .spyOn(chatsGateway, 'emitMemberJoin')
        .mockImplementation(() => undefined);
      jest
        .spyOn(chatsGateway, 'emitChannelCreated')
        .mockImplementation(() => undefined);
      jest
        .spyOn(chatsGateway, 'joinChannelRoom')
        .mockImplementation(() => undefined);
    });
    it('should join user to the public channel', async () => {
      const userId = usersEntities[0].userId;
      let newChannelData: CreateChannelDto = {
        channelName: 'newChannel',
        accessMode: 'public',
      };
      newChannelData = (await new ValidateChannelInfoPipe().transform(
        newChannelData,
      )) as CreateChannelDto;
      const newChannelId = await service.createChannel(userId, newChannelData);
      const anotherUserId = usersEntities[1].userId;
      await service.joinChannel(newChannelId, anotherUserId, false);
      expect(
        channelStorage.getUser(anotherUserId).has(newChannelId),
      ).toBeTruthy();
      expect(memberJoinSpy).toBeCalledWith(newChannelId, anotherUserId);

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
      newChannelData = (await new ValidateChannelInfoPipe().transform(
        newChannelData,
      )) as CreateChannelDto;
      const newChannelId = await service.createChannel(userId, newChannelData);
      const anotherUserId = usersEntities[1].userId;
      await service.joinChannel(newChannelId, anotherUserId, false, '1q2w3e4r');
      expect(
        channelStorage.getUser(anotherUserId).has(newChannelId),
      ).toBeTruthy();
      expect(memberJoinSpy).toBeCalledWith(newChannelId, anotherUserId);

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
      newChannelData = (await new ValidateChannelInfoPipe().transform(
        newChannelData,
      )) as CreateChannelDto;
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
      newChannelData = (await new ValidateChannelInfoPipe().transform(
        newChannelData,
      )) as CreateChannelDto;
      const newChannelId = await service.createChannel(userId, newChannelData);
      const anotherUserId = usersEntities[1].userId;
      await service.joinChannel(newChannelId, anotherUserId, true);
      expect(
        channelStorage.getUser(anotherUserId).has(newChannelId),
      ).toBeTruthy();
      expect(memberJoinSpy).toBeCalledWith(newChannelId, anotherUserId);

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
      newChannelData = (await new ValidateChannelInfoPipe().transform(
        newChannelData,
      )) as CreateChannelDto;
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
      newChannelData = (await new ValidateChannelInfoPipe().transform(
        newChannelData,
      )) as CreateChannelDto;
      const newChannelId = await service.createChannel(userId, newChannelData);
      const anotherUserId = usersEntities[1].userId;
      await service.joinChannel(newChannelId, anotherUserId, true);
      expect(
        channelStorage.getUser(anotherUserId).has(newChannelId),
      ).toBeTruthy();
      expect(memberJoinSpy).toBeCalledWith(newChannelId, anotherUserId);

      expect(channelStorage.getUserRole(newChannelId, anotherUserId)).toBe(
        'member',
      );
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
      jest
        .spyOn(chatsGateway, 'emitChannelCreated')
        .mockImplementation(() => undefined);
      jest
        .spyOn(chatsGateway, 'joinChannelRoom')
        .mockImplementation(() => undefined);
    });
    it('should leave channel (not owner)', async () => {
      const userId = usersEntities[0].userId;
      let newChannelData: CreateChannelDto = {
        channelName: 'newChannel',
        password: 'password',
        accessMode: 'protected',
      };
      newChannelData = (await new ValidateChannelInfoPipe().transform(
        newChannelData,
      )) as CreateChannelDto;
      const newChannelId = await service.createChannel(userId, newChannelData);
      const anotherUserId = usersEntities[1].userId;
      await service.joinChannel(newChannelId, anotherUserId, true);

      await service.leaveChannel(newChannelId, anotherUserId);
      expect(
        channelStorage.getUser(anotherUserId).has(newChannelId),
      ).toBeFalsy();
      expect(memberLeftSpy).toBeCalledWith(newChannelId, anotherUserId, false);

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
      newChannelData = (await new ValidateChannelInfoPipe().transform(
        newChannelData,
      )) as CreateChannelDto;
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
      newChannelData = (await new ValidateChannelInfoPipe().transform(
        newChannelData,
      )) as CreateChannelDto;
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
      const ret = await service.findChannelMessages(channelId, 0, 3);
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
      const ret = await service.findChannelMessages(channelId, 0, 10001);
      expect(ret).toEqual({ messages: [...messagesDto] });
      await dataSource.getRepository(Messages).remove(messages);
    });

    it('should not find messages (offset, size) if the offset is bigger than the number of messages', async () => {
      const channelId = Array.from(channelStorage.getChannels()).find(
        (v) => v[1].userRoleMap.size > 3,
      )[0];
      if (!channelId) {
        return console.log(
          'FIND CHANNEL MESSAGES WITH BIG OFFSET TEST SKIPPED!!!',
        );
      }
      const messages = generateMessages(
        channelMembersEntities.filter((v) => v.channelId === channelId),
      );
      await dataSource.getRepository(Messages).insert(messages);
      const ret = await service.findChannelMessages(channelId, 2147483648, 3);
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
        .mockImplementation((channelId, userId) => {
          // NOTE : Access Private Method
          (chatsGateway as any).emitMessageArrived(channelId);
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
        .spyOn(chatsGateway as any, 'emitMessageArrived') // NOTE : Access Private Method
        .mockImplementation(() => undefined);
      jest
        .spyOn(chatsGateway, 'emitMemberJoin')
        .mockImplementation(() => undefined);
      jest
        .spyOn(chatsGateway, 'emitChannelCreated')
        .mockImplementation(() => undefined);
      jest
        .spyOn(chatsGateway, 'joinChannelRoom')
        .mockImplementation(() => undefined);
    });

    it('should create message and then notify new message arrived', async () => {
      const userId = usersEntities[1].userId;
      let newChannelData: CreateChannelDto = {
        channelName: 'newChannel',
        accessMode: 'private',
      };
      newChannelData = (await new ValidateChannelInfoPipe().transform(
        newChannelData,
      )) as CreateChannelDto;
      const newChannelId = await service.createChannel(userId, newChannelData);
      const anotherUserId = usersEntities[2].userId;
      activityManager.setActivity(userId, `chatRooms-${newChannelId}`);
      activityManager.setActivity(anotherUserId, 'profile');

      await service.joinChannel(newChannelId, anotherUserId, true);
      const msg = { message: 'hello message!' };
      await service.createMessage(newChannelId, userId, msg.message);
      expect(newMessageSpy).toBeCalledWith(
        newChannelId,
        userId,
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

    it('should execute role command (executor : owner)', async () => {
      const ownerId = usersEntities[1].userId;
      let newChannelData: CreateChannelDto = {
        channelName: 'newChannel',
        accessMode: 'private',
      };
      newChannelData = (await new ValidateChannelInfoPipe().transform(
        newChannelData,
      )) as CreateChannelDto;
      const newChannelId = await service.createChannel(ownerId, newChannelData);
      const anotherUserId = usersEntities[2].userId;

      await service.joinChannel(newChannelId, anotherUserId, true);
      await service.executeCommand(newChannelId, ownerId, [
        'role',
        anotherUserId,
        'admin',
      ]);
      expect(channelStorage.getUserRole(newChannelId, anotherUserId)).toBe(
        'admin',
      );
      expect(roleChangedSpy).toBeCalledWith(
        anotherUserId,
        newChannelId,
        'admin',
      );
      await service.executeCommand(newChannelId, ownerId, [
        'role',
        anotherUserId,
        'member',
      ]);
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
      newChannelData = (await new ValidateChannelInfoPipe().transform(
        newChannelData,
      )) as CreateChannelDto;
      const newChannelId = await service.createChannel(ownerId, newChannelData);
      const memberId = usersEntities[2].userId;
      const adminId = usersEntities[3].userId;

      await service.joinChannel(newChannelId, adminId, true);
      await service.joinChannel(newChannelId, memberId, true);

      await service.executeCommand(newChannelId, ownerId, [
        'role',
        adminId,
        'admin',
      ]);
      expect(channelStorage.getUserRole(newChannelId, adminId)).toBe('admin');
      expect(roleChangedSpy).toBeCalledWith(adminId, newChannelId, 'admin');

      await service.executeCommand(newChannelId, adminId, [
        'role',
        memberId,
        'admin',
      ]);
      expect(channelStorage.getUserRole(newChannelId, memberId)).toBe('admin');
      expect(roleChangedSpy).toBeCalledWith(memberId, newChannelId, 'admin');
    });

    it('should not execute role command (executor : member)', async () => {
      const ownerId = usersEntities[1].userId;
      let newChannelData: CreateChannelDto = {
        channelName: 'newChannel',
        accessMode: 'private',
      };
      newChannelData = (await new ValidateChannelInfoPipe().transform(
        newChannelData,
      )) as CreateChannelDto;
      const newChannelId = await service.createChannel(ownerId, newChannelData);
      const memberId = usersEntities[2].userId;
      const adminId = usersEntities[3].userId;

      await service.joinChannel(newChannelId, adminId, true);
      await service.joinChannel(newChannelId, memberId, true);

      await service.executeCommand(newChannelId, ownerId, [
        'role',
        adminId,
        'admin',
      ]);
      expect(channelStorage.getUserRole(newChannelId, adminId)).toBe('admin');
      expect(roleChangedSpy).toBeCalledWith(adminId, newChannelId, 'admin');

      expect(
        async () =>
          await service.executeCommand(newChannelId, memberId, [
            'role',
            adminId,
            'member',
          ]),
      ).rejects.toThrow(ForbiddenException);

      expect(
        async () =>
          await service.executeCommand(newChannelId, memberId, [
            'role',
            adminId,
            'admin',
          ]),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw if a user attempt to execute command with invalid permission (member -> owner) ', async () => {
      const ownerId = usersEntities[1].userId;
      let newChannelData: CreateChannelDto = {
        channelName: 'newChannel',
        accessMode: 'private',
      };
      newChannelData = (await new ValidateChannelInfoPipe().transform(
        newChannelData,
      )) as CreateChannelDto;
      const newChannelId = await service.createChannel(ownerId, newChannelData);
      const anotherUserId = usersEntities[2].userId;
      await service.joinChannel(newChannelId, anotherUserId, true);
      expect(
        async () =>
          await service.executeCommand(newChannelId, anotherUserId, [
            'role',
            ownerId,
            'admin',
          ]),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw if attempt to execute command with invalid permission (admin -> owner) ', async () => {
      const ownerId = usersEntities[1].userId;
      let newChannelData: CreateChannelDto = {
        channelName: 'newChannel',
        accessMode: 'private',
      };
      newChannelData = (await new ValidateChannelInfoPipe().transform(
        newChannelData,
      )) as CreateChannelDto;
      const newChannelId = await service.createChannel(ownerId, newChannelData);
      const anotherUserId = usersEntities[2].userId;
      await service.joinChannel(newChannelId, anotherUserId, true);
      expect(
        async () =>
          await service.executeCommand(newChannelId, anotherUserId, [
            'role',
            ownerId,
            'admin',
          ]),
      ).rejects.toThrow(ForbiddenException);
      expect(
        async () =>
          await service.executeCommand(newChannelId, anotherUserId, [
            'ban',
            ownerId,
            '42',
          ]),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should execute mute command (admin -> member)', async () => {
      const ownerId = usersEntities[1].userId;
      let newChannelData: CreateChannelDto = {
        channelName: 'newChannel',
        accessMode: 'private',
      };
      newChannelData = (await new ValidateChannelInfoPipe().transform(
        newChannelData,
      )) as CreateChannelDto;
      const newChannelId = await service.createChannel(ownerId, newChannelData);
      const memberId = usersEntities[2].userId;
      const adminId = usersEntities[3].userId;

      await service.joinChannel(newChannelId, adminId, true);
      await service.joinChannel(newChannelId, memberId, true);

      await service.executeCommand(newChannelId, ownerId, [
        'role',
        adminId,
        'admin',
      ]);
      expect(channelStorage.getUserRole(newChannelId, adminId)).toBe('admin');
      expect(roleChangedSpy).toBeCalledWith(adminId, newChannelId, 'admin');

      await service.executeCommand(newChannelId, ownerId, [
        'mute',
        memberId,
        '5',
      ]);
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

    it('should not execute mute command (admin -> owner)', async () => {
      const ownerId = usersEntities[1].userId;
      let newChannelData: CreateChannelDto = {
        channelName: 'newChannel',
        accessMode: 'private',
      };
      newChannelData = (await new ValidateChannelInfoPipe().transform(
        newChannelData,
      )) as CreateChannelDto;
      const newChannelId = await service.createChannel(ownerId, newChannelData);
      const memberId = usersEntities[2].userId;
      const adminId = usersEntities[3].userId;

      await service.joinChannel(newChannelId, adminId, true);
      await service.joinChannel(newChannelId, memberId, true);

      await service.executeCommand(newChannelId, ownerId, [
        'role',
        adminId,
        'admin',
      ]);
      expect(channelStorage.getUserRole(newChannelId, adminId)).toBe('admin');
      expect(roleChangedSpy).toBeCalledWith(adminId, newChannelId, 'admin');

      expect(
        async () =>
          await service.executeCommand(newChannelId, adminId, [
            'mute',
            ownerId,
            '5',
          ]),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should execute ban command (admin -> member)', async () => {
      const ownerId = usersEntities[1].userId;
      let newChannelData: CreateChannelDto = {
        channelName: 'newChannel',
        accessMode: 'private',
      };
      newChannelData = (await new ValidateChannelInfoPipe().transform(
        newChannelData,
      )) as CreateChannelDto;
      const newChannelId = await service.createChannel(ownerId, newChannelData);
      const memberId = usersEntities[2].userId;
      const adminId = usersEntities[3].userId;

      await service.joinChannel(newChannelId, adminId, true);
      await service.joinChannel(newChannelId, memberId, true);

      await service.executeCommand(newChannelId, ownerId, [
        'role',
        adminId,
        'admin',
      ]);
      expect(channelStorage.getUserRole(newChannelId, adminId)).toBe('admin');
      expect(roleChangedSpy).toBeCalledWith(adminId, newChannelId, 'admin');

      await service.executeCommand(newChannelId, adminId, [
        'ban',
        memberId,
        '5',
      ]);
      expect(
        Math.round(
          DateTime.now()
            .diff(await channelStorage.getBanEndAt(newChannelId, memberId), [
              'minutes',
            ])
            .toObject().minutes,
        ),
      ).toBe(-5);

      expect(memberLeftSpy).toBeCalledWith(newChannelId, memberId, false);
    });

    it('should execute kick command', async () => {
      const ownerId = usersEntities[1].userId;
      let newChannelData: CreateChannelDto = {
        channelName: 'newChannel',
        accessMode: 'private',
      };
      newChannelData = (await new ValidateChannelInfoPipe().transform(
        newChannelData,
      )) as CreateChannelDto;
      const newChannelId = await service.createChannel(ownerId, newChannelData);
      const memberId = usersEntities[2].userId;
      const adminId = usersEntities[3].userId;

      await service.joinChannel(newChannelId, adminId, true);
      await service.joinChannel(newChannelId, memberId, true);

      await service.executeCommand(newChannelId, ownerId, ['kick', memberId]);
      expect(
        (
          await dataSource
            .getRepository(BannedMembers)
            .findOneBy({ memberId, channelId: newChannelId })
        ).endAt > DateTime.now().plus({ years: 141 }),
      ).toBeTruthy();
    });

    it('should not execute kick command', async () => {
      const ownerId = usersEntities[1].userId;
      let newChannelData: CreateChannelDto = {
        channelName: 'newChannel',
        accessMode: 'private',
      };
      newChannelData = (await new ValidateChannelInfoPipe().transform(
        newChannelData,
      )) as CreateChannelDto;
      const newChannelId = await service.createChannel(ownerId, newChannelData);
      const memberId = usersEntities[2].userId;
      const adminId = usersEntities[3].userId;

      await service.joinChannel(newChannelId, adminId, true);
      await service.joinChannel(newChannelId, memberId, true);

      // member to owner
      expect(
        async () =>
          await service.executeCommand(newChannelId, memberId, [
            'kick',
            ownerId,
          ]),
      ).rejects.toThrow(ForbiddenException);

      // member to admin
      expect(
        async () =>
          await service.executeCommand(newChannelId, memberId, [
            'kick',
            memberId,
          ]),
      ).rejects.toThrow(ForbiddenException);

      // admin to owner
      expect(
        async () =>
          await service.executeCommand(newChannelId, adminId, [
            'kick',
            ownerId,
          ]),
      ).rejects.toThrow(ForbiddenException);

      // owner to owner
      expect(
        async () =>
          await service.executeCommand(newChannelId, ownerId, [
            'kick',
            ownerId,
          ]),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('updateChannel', () => {
    let channelShown: jest.SpyInstance;
    let channelHiddenSpy: jest.SpyInstance;
    let channelUpdatedSpy: jest.SpyInstance;
    beforeEach(() => {
      channelShown = jest
        .spyOn(chatsGateway, 'emitChannelShown')
        .mockImplementation(() => undefined);
      channelHiddenSpy = jest
        .spyOn(chatsGateway, 'emitChannelHidden')
        .mockImplementation(() => undefined);
      channelUpdatedSpy = jest
        .spyOn(chatsGateway, 'emitChannelUpdated')
        .mockImplementation(() => undefined);
      const joinChannelSpy = jest
        .spyOn(service, 'joinChannel')
        .mockImplementation(() => undefined);
    });

    it('should update channel (public -> public)', async () => {
      const channel = channelsEntities.find((c) => c.accessMode === 'public');
      if (!channel) {
        console.log('SKIP CHANNEL UPDATE TEST !!');
      }
      const channelId = channel.channelId;
      const updatedChannelData: UpdateChannelDto = {
        accessMode: 'public',
      };
      await service.updateChannel(channelId, updatedChannelData);
      expect(channelStorage.getChannel(channelId).accessMode).toBe(
        updatedChannelData.accessMode,
      );
      expect(channelUpdatedSpy).toBeCalledWith(
        channelId,
        0,
        updatedChannelData.accessMode,
      );
    });

    it('should update channel (public -> protected)', async () => {
      const channel = channelsEntities.filter(
        (c) => c.accessMode === 'public',
      )[1];
      if (!channel) {
        console.log('SKIP CHANNEL UPDATE TEST !!');
      }
      const channelId = channel.channelId;
      const updatedChannelData: UpdateChannelDto = {
        accessMode: 'protected',
        password: '123456abcd',
      };
      await service.updateChannel(channelId, updatedChannelData);
      expect(channelStorage.getChannel(channelId).accessMode).toBe(
        updatedChannelData.accessMode,
      );
      expect(channelUpdatedSpy).toBeCalledWith(
        channelId,
        0,
        updatedChannelData.accessMode,
      );
    });

    it('should update channel (public -> private)', async () => {
      const channel = channelsEntities.filter(
        (c) => c.accessMode === 'public',
      )[2];
      if (!channel) {
        console.log('SKIP CHANNEL UPDATE TEST !!');
      }
      const channelId = channel.channelId;
      const updatedChannelData: UpdateChannelDto = {
        accessMode: 'private',
      };
      await service.updateChannel(channelId, updatedChannelData);
      expect(channelStorage.getChannel(channelId).accessMode).toBe(
        updatedChannelData.accessMode,
      );
      expect(channelUpdatedSpy).toBeCalledWith(
        channelId,
        0,
        updatedChannelData.accessMode,
      );
      expect(channelHiddenSpy).toBeCalledWith(channelId);
    });

    it('should update channel (protected -> public)', async () => {
      const channel = channelsEntities.filter(
        (c) => c.accessMode === 'protected',
      )[0];
      if (!channel) {
        console.log('SKIP CHANNEL UPDATE TEST !!');
      }
      const channelId = channel.channelId;
      const updatedChannelData: UpdateChannelDto = {
        accessMode: 'public',
      };
      await service.updateChannel(channelId, updatedChannelData);
      expect(channelStorage.getChannel(channelId).accessMode).toBe(
        updatedChannelData.accessMode,
      );
      expect(channelUpdatedSpy).toBeCalledWith(
        channelId,
        0,
        updatedChannelData.accessMode,
      );
    });

    it('should update channel (protected -> protected)', async () => {
      const channel = channelsEntities.filter(
        (c) => c.accessMode === 'protected',
      )[1];
      if (!channel) {
        console.log('SKIP CHANNEL UPDATE TEST !!');
      }
      const channelId = channel.channelId;
      const updatedChannelData: UpdateChannelDto = {
        accessMode: 'protected',
        password: '123456abcd',
      };
      await service.updateChannel(channelId, updatedChannelData);
      expect(channelStorage.getChannel(channelId).accessMode).toBe(
        updatedChannelData.accessMode,
      );
      expect(channelUpdatedSpy).toBeCalledWith(
        channelId,
        0,
        updatedChannelData.accessMode,
      );
    });

    it('should update channel (protected -> private)', async () => {
      const channel = channelsEntities.filter(
        (c) => c.accessMode === 'protected',
      )[2];
      if (!channel) {
        console.log('SKIP CHANNEL UPDATE TEST !!');
      }
      const channelId = channel.channelId;
      const updatedChannelData: UpdateChannelDto = {
        accessMode: 'private',
      };
      await service.updateChannel(channelId, updatedChannelData);
      expect(channelStorage.getChannel(channelId).accessMode).toBe(
        updatedChannelData.accessMode,
      );
      expect(channelUpdatedSpy).toBeCalledWith(
        channelId,
        0,
        updatedChannelData.accessMode,
      );
      expect(channelHiddenSpy).toBeCalledWith(channelId);
    });

    it('should update channel (private -> public)', async () => {
      const channel = channelsEntities.filter(
        (c) => c.accessMode === 'private',
      )[0];
      if (!channel) {
        console.log('SKIP CHANNEL UPDATE TEST !!');
      }
      const channelId = channel.channelId;
      const updatedChannelData: UpdateChannelDto = {
        accessMode: 'public',
      };
      await service.updateChannel(channelId, updatedChannelData);
      expect(channelStorage.getChannel(channelId).accessMode).toBe(
        updatedChannelData.accessMode,
      );
      expect(channelUpdatedSpy).toBeCalledWith(
        channelId,
        0,
        updatedChannelData.accessMode,
      );
      expect(channelShown).toBeCalledWith(
        channelId,
        channel.name,
        updatedChannelData.accessMode,
        channelStorage.getChannel(channelId).userRoleMap.size,
      );
    });

    it('should update channel (private -> protected)', async () => {
      const channel = channelsEntities.filter(
        (c) => c.accessMode === 'private',
      )[1];
      if (!channel) {
        console.log('SKIP CHANNEL UPDATE TEST !!');
      }
      const channelId = channel.channelId;
      const updatedChannelData: UpdateChannelDto = {
        accessMode: 'protected',
        password: '123456abcd',
      };
      await service.updateChannel(channelId, updatedChannelData);
      expect(channelStorage.getChannel(channelId).accessMode).toBe(
        updatedChannelData.accessMode,
      );
      expect(channelUpdatedSpy).toBeCalledWith(
        channelId,
        0,
        updatedChannelData.accessMode,
      );
      expect(channelShown).toBeCalledWith(
        channelId,
        channel.name,
        updatedChannelData.accessMode,
        channelStorage.getChannel(channelId).userRoleMap.size,
      );
    });

    it('should update channel (private -> private)', async () => {
      const channel = channelsEntities.filter(
        (c) => c.accessMode === 'private',
      )[2];
      if (!channel) {
        console.log('SKIP CHANNEL UPDATE TEST !!');
      }
      const channelId = channel.channelId;
      const updatedChannelData: UpdateChannelDto = {
        accessMode: 'private',
      };
      await service.updateChannel(channelId, updatedChannelData);
      expect(channelStorage.getChannel(channelId).accessMode).toBe(
        updatedChannelData.accessMode,
      );
      expect(channelUpdatedSpy).toBeCalledWith(
        channelId,
        0,
        updatedChannelData.accessMode,
      );
    });
  });
});

const generateRandomKorean = (length: number) => {
  const result = [];
  for (let i = 0; i < length; i++) {
    result.push(
      String.fromCharCode(Math.floor(Math.random() * 11172) + 0xac00),
    );
  }
  return result.join('');
};
