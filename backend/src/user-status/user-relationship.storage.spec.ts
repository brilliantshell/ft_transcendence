import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule, TypeOrmModuleOptions } from '@nestjs/typeorm';
import { UserRelationshipStorage } from './user-relationship.storage';

import { PeerInfo, Relationship, UserId } from '../util/type';
import { Friends } from '../entity/friends.entity';
import { Users } from '../entity/users.entity';
import { BlockedUsers } from '../entity/blocked-users.entity';
import { DataSource, Repository } from 'typeorm';

const typeOrmConfig: TypeOrmModuleOptions = {
  type: 'postgres',
  host: 'localhost',
  port: 5432,
  username: 'test_user',
  password: 'test_password',
  database: 'test_db',
  autoLoadEntities: true,
  synchronize: true,
};

describe('UserRelationshipService', () => {
  let userRelationshipStorage: UserRelationshipStorage;
  let dataSource: DataSource;

  beforeAll(async () => {
    dataSource = await new DataSource({
      type: 'postgres',
      host: 'localhost',
      port: 5432,
      username: 'test_user',
      password: 'test_password',
      database: 'test_db',
      entities: [Users, Friends],
    }).initialize();
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot(typeOrmConfig),
        TypeOrmModule.forFeature([BlockedUsers, Friends, Users]),
      ],
      providers: [UserRelationshipStorage],
    }).compile();

    userRelationshipStorage = module.get<UserRelationshipStorage>(
      UserRelationshipStorage,
    );
  });

  afterAll(() => {});

  it('should be defined', () => {
    expect(userRelationshipStorage).toBeDefined();
  });

  it('should load a user who does not have any relationship', () => {
    userRelationshipStorage.load(1);

    const userRelationshipMap: Map<UserId, PeerInfo> =
      userRelationshipStorage.getRelationshipMap(1);
    expect(userRelationshipMap.get(-4242)).toEqual(null);
  });

  it('should add a friend and check friendship', async () => {
    userRelationshipStorage.load(1);
    userRelationshipStorage.load(2);

    await userRelationshipStorage.addRelationship(1, 2, 'friendRequest');

    const active: Relationship = userRelationshipStorage.getRelationship(1, 2);
    expect(active).toBe('pendingSender');

    const passive: Relationship = userRelationshipStorage.getRelationship(2, 1);
    expect(passive).toBe('pendingReceiver');
  });

  it('should become a friend now', async () => {
    userRelationshipStorage.load(1);
    userRelationshipStorage.load(2);

    await userRelationshipStorage.addRelationship(1, 2, 'friendRequest');

    await userRelationshipStorage.acceptFriendRequest(2, 1);

    const active = userRelationshipStorage.getRelationship(1, 2);
    expect(active).toBe('friend');

    const passive = userRelationshipStorage.getRelationship(2, 1);
    expect(passive).toBe('friend');
  });

  it('should update database as relationship between two users as they become friends', async () => {
    userRelationshipStorage.load(1);
    userRelationshipStorage.load(999);

    await userRelationshipStorage.addRelationship(1, 999, 'friendRequest');

    const friendsRepository: Repository<Friends> =
      dataSource.getRepository(Friends);

    let db_result = await friendsRepository.findOne({
      where: { sender_id: 1, receiver_id: 999 },
    });
    expect(db_result).toBeDefined();
    expect(db_result.is_accepted).toEqual(false);

    await userRelationshipStorage.acceptFriendRequest(999, 1);
    db_result = await friendsRepository.findOne({
      where: { sender_id: 1, receiver_id: 999 },
    });
    expect(db_result.is_accepted).toEqual(true);
  });

  it('should delete a friend relationship', async () => {
    userRelationshipStorage.load(1);
    userRelationshipStorage.load(2);

    await userRelationshipStorage.addRelationship(1, 2, 'friendRequest');
    await userRelationshipStorage.acceptFriendRequest(2, 1);

    await userRelationshipStorage.deleteRelationship(1, 2);
    await userRelationshipStorage.deleteRelationship(1, 999);

    expect(userRelationshipStorage.getRelationship(1, 2)).toBe(null);

    expect(userRelationshipStorage.getRelationship(2, 1)).toBe(null);

    expect(userRelationshipStorage.getRelationship(1, 999)).toBe(null);

    expect(userRelationshipStorage.getRelationshipMap(999)).toBeFalsy();
  });
});
