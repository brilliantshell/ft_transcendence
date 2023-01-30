import { Test, TestingModule } from '@nestjs/testing';

import { ChatsGateway } from './chats.gateway';
import { ChatsService } from './chats.service';
import { UserStatusModule } from '../user-status/user-status.module';
import { getDataSourceToken, TypeOrmModule } from '@nestjs/typeorm';
import { BannedMembers } from '../entity/banned-members.entity';
import { BlockedUsers } from '../entity/blocked-users.entity';
import { ChannelMembers } from '../entity/channel-members.entity';
import { Channels } from '../entity/channels.entity';
import { Friends } from '../entity/friends.entity';
import { Messages } from '../entity/messages.entity';
import { Users } from '../entity/users.entity';
import { UserRelationshipStorage } from '../user-status/user-relationship.storage';
import { ChannelStorage } from '../user-status/channel.storage';
import {
  createDataSources,
  destroyDataSources,
  TYPEORM_SHARED_CONFIG,
} from '../../test/db-resource-manager';
import { DataSource } from 'typeorm';

const TEST_DB = 'test_db_chat_service';
const ENTITIES = [
  Friends,
  BannedMembers,
  BlockedUsers,
  ChannelMembers,
  Channels,
  Messages,
  Users,
];

describe('ChatsService', () => {
  let dataSource: DataSource;
  let initDataSource: DataSource;
  let service: ChatsService;
  let userRelationshipStorage: UserRelationshipStorage;
  let channelStorage: ChannelStorage;

  beforeAll(async () => {
    const dataSources = await createDataSources(TEST_DB, ENTITIES);
    initDataSource = dataSources.initDataSource;
    dataSource = dataSources.dataSource;
  });

  beforeEach(async () => {
    const dataSourceToken = getDataSourceToken();
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        UserStatusModule,
        TypeOrmModule.forRoot({
          type: 'postgres',
          ...TYPEORM_SHARED_CONFIG,
          autoLoadEntities: true,
          database: TEST_DB,
        }),
      ],
      providers: [ChatsGateway, ChatsService],
    }).compile();

    service = module.get<ChatsService>(ChatsService);
    userRelationshipStorage = module.get<UserRelationshipStorage>(
      UserRelationshipStorage,
    );

    channelStorage = module.get<ChannelStorage>(ChannelStorage);
  });

  afterAll(
    async () => await destroyDataSources(TEST_DB, dataSource, initDataSource),
  );
  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should be able to find the user joined channels and all public channels sorted by modifiedAt', () => {
    const userId = 1;
    const result = service.findAllChannels(userId);
    expect(result).toBeDefined();
  });
});
