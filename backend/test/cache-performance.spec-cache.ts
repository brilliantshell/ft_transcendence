import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule, getRepositoryToken } from '@nestjs/typeorm';

import { AppModule } from '../src/app.module';
import { ChannelStorage } from '../src/user-status/channel.storage';
import { FriendListDto } from '../src/user/dto/user.dto';
import { Relationship, UserId } from '../src/util/type';
import { TYPEORM_SHARED_CONFIG } from './util/db-resource-manager';
import { UserRelationshipStorage } from '../src/user-status/user-relationship.storage';
import { Users } from '../src/entity/users.entity';

const TEST_DB = 'test_db_cache_performance';

process.env.DB_HOST = 'localhost';
process.env.NODE_ENV = 'development';

describe('Caching performance test', () => {
  let app: INestApplication;
  let userRelationshipStorage: UserRelationshipStorage;
  let channelStorage: ChannelStorage;
  let users: Users[];
  let userIds: UserId[];

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'postgres',
          ...TYPEORM_SHARED_CONFIG,
          autoLoadEntities: true,
          database: TEST_DB,
        }),
        AppModule,
      ],
    }).compile();
    app = moduleFixture.createNestApplication();
    await app.init();
    const usersRepository = app.get(getRepositoryToken(Users));
    userRelationshipStorage = app.get(UserRelationshipStorage);
    channelStorage = app.get(ChannelStorage);
    users = await usersRepository.find({ select: ['userId'] });
    userIds = users.map((user) => user.userId);
    let sum = 0;
    for (const userId of userIds) {
      const now = Date.now();
      await userRelationshipStorage.load(userId);
      await channelStorage.loadUser(userId);
      sum += Date.now() - now;
    }
    console.log('Load time average : ' + sum / userIds.length + 'ms');
  });

  describe('UserRelationshipStorage', () => {
    it('CACHED getRelationship', async () => {
      for (let i = 0; i < 100; ++i) {
        for (let k = 0; k < 100; ++k) {
          if (i === k) {
            continue;
          }
          userRelationshipStorage.getRelationship(userIds[i], userIds[k]);
        }
      }
    });

    it('SQL getRelationship', async () => {
      const promises: Promise<Relationship>[] = [];
      for (let i = 0; i < 100; ++i) {
        for (let k = 0; k < 100; ++k) {
          if (i === k) {
            continue;
          }
          promises.push(
            userRelationshipStorage.getRelationshipFromDb(
              userIds[i],
              userIds[k],
            ),
          );
        }
      }
      await Promise.all(promises);
    });

    it('CACHED getFriends', async () => {
      for (let i = 0; i < 100; ++i) {
        userRelationshipStorage.getFriends(userIds[i]);
      }
    });

    it('SQL getFriends', async () => {
      const promises: Promise<FriendListDto>[] = [];
      for (let i = 0; i < 100; ++i) {
        promises.push(userRelationshipStorage.getFriendsFromDb(userIds[i]));
      }
      await Promise.all(promises);
    });
  });

  describe('ChannelStorage', () => {
    it('CACHED getChannel', async () => {
      const channels = channelStorage.getChannels();
      for (const [channelId, _] of channels) {
        channelStorage.getChannel(channelId);
      }
    });

    it('SQL getChannel', async () => {
      const promises: Promise<void>[] = [];
      const channels = channelStorage.getChannels();
      for (const [channelId, _] of channels) {
        promises.push(channelStorage.getChannelFromDb(channelId));
      }
      await Promise.all(promises);
    });

    it('CACHED getUser', async () => {
      for (let i = 0; i < 100; ++i) {
        channelStorage.getUser(userIds[i]);
      }
    });

    it('SQL getUser', async () => {
      const promises: Promise<void>[] = [];
      for (let i = 0; i < 100; ++i) {
        promises.push(channelStorage.getUserFromDb(userIds[i]));
      }
      await Promise.all(promises);
    });
  });
});
