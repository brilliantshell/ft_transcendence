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
});
