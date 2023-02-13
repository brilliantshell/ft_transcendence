import { DataSource } from 'typeorm';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { nanoid } from 'nanoid';

import { BlockedUsers } from '../entity/blocked-users.entity';
import { Channels } from '../entity/channels.entity';
import { Friends } from '../entity/friends.entity';
import { GameGateway } from './game.gateway';
import { GameId, GameInfo } from '../util/type';
import { GameService } from './game.service';
import { GameStorage } from './game.storage';
import { RanksGateway } from '../ranks/ranks.gateway';
import { UserRelationshipStorage } from '../user-status/user-relationship.storage';
import { UserSocketStorage } from '../user-status/user-socket.storage';
import { Users } from '../entity/users.entity';
import {
  TYPEORM_SHARED_CONFIG,
  createDataSources,
  destroyDataSources,
} from '../../test/util/db-resource-manager';
import { generateUsers } from '../../test/util/generate-mock-data';

const TEST_DB = 'test_db_game_service';
const ENTITIES = [BlockedUsers, Channels, Friends, Users];

describe('GameService', () => {
  let service: GameService;
  let gameStorage: GameStorage;
  let userRelationshipStorage: UserRelationshipStorage;
  let userSocketStorage: UserSocketStorage;
  let gameGateway: GameGateway;
  let gameId: GameId;
  let usersEntities: Users[];
  let currentUsers: Users[];
  let dataSource: DataSource;
  let initDataSource: DataSource;
  let index = 0;
  let playerOne: Users;
  let playerTwo: Users;
  let spectatorOne: Users;
  let spectatorTwo: Users;

  beforeAll(async () => {
    const dataSources = await createDataSources(TEST_DB, ENTITIES);
    initDataSource = dataSources.initDataSource;
    dataSource = dataSources.dataSource;
    usersEntities = generateUsers(64);
    await dataSource.getRepository(Users).insert(usersEntities);
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
        TypeOrmModule.forFeature([BlockedUsers, Channels, Friends, Users]),
      ],
      providers: [
        GameGateway,
        GameService,
        GameStorage,
        RanksGateway,
        UserRelationshipStorage,
        UserSocketStorage,
      ],
    })
      .overrideProvider(GameGateway)
      .useValue({
        joinRoom: jest.fn((socketId: string, roomId: string) => undefined),
      })
      .compile();
    service = module.get<GameService>(GameService);
    gameGateway = module.get<GameGateway>(GameGateway);
    gameStorage = module.get<GameStorage>(GameStorage);
    userRelationshipStorage = module.get<UserRelationshipStorage>(
      UserRelationshipStorage,
    );
    userSocketStorage = module.get<UserSocketStorage>(UserSocketStorage);
    gameId = nanoid();
    currentUsers = usersEntities.slice(index, index + 4);
    [playerOne, playerTwo, spectatorOne, spectatorTwo] = currentUsers;
    await Promise.all(
      currentUsers.map(({ userId }) => {
        const socketId = nanoid();
        userSocketStorage.clients.set(userId, socketId);
        userSocketStorage.sockets.set(socketId, userId);
        return userRelationshipStorage.load(userId);
      }),
    );
    index += 4;
  });

  afterEach(async () => {
    await Promise.all(
      currentUsers.map(({ userId }) => userRelationshipStorage.unload(userId)),
    );
  });

  afterAll(
    async () => await destroyDataSources(TEST_DB, dataSource, initDataSource),
  );

  describe('GAME LIST', () => {
    it('should return an empty list of games', () => {
      expect(service.findGames()).toEqual([]);
    });

    it('should return a list of games', () => {
      const games = [];
      for (let i = 0; i < 10; i++) {
        const newGameId = nanoid();
        gameStorage.games.set(
          newGameId,
          new GameInfo(usersEntities[0], usersEntities[1], 1, true),
        );
        games.push({
          id: newGameId,
          left: usersEntities[0].nickname,
          right: usersEntities[1].nickname,
        });
      }
      index += 10;
      expect(service.findGames()).toEqual(games.reverse());
    });
  });

  describe('SPECTATOR', () => {
    it('should return game information when a user tries to spectate a game', () => {
      gameStorage.games.set(
        gameId,
        new GameInfo(playerOne, playerTwo, 1, true),
      );
      expect(service.findGameInfo(spectatorOne.userId, gameId)).toEqual({
        leftPlayer: playerOne.nickname,
        rightPlayer: playerTwo.nickname,
        map: 1,
      });
    });

    it("should put the spectator's socket into the game's WebSocket room", () => {
      gameStorage.games.set(
        gameId,
        new GameInfo(playerOne, playerTwo, 1, true),
      );
      service.findGameInfo(spectatorOne.userId, gameId);
      expect(gameGateway.joinRoom).toHaveBeenCalledWith(
        userSocketStorage.clients.get(spectatorOne.userId),
        `game-${gameId}`,
      );
    });

    it('should throw NOT FOUND when a user tries to spectate a game that does not exist', () => {
      expect(() =>
        service.findGameInfo(spectatorOne.userId, gameId),
      ).toThrowError(NotFoundException);
    });

    it('should throw FORBIDDEN when the spectator of a normal game is blocked by either of the players', async () => {
      await userRelationshipStorage.blockUser(
        playerOne.userId,
        spectatorOne.userId,
      );
      gameStorage.games.set(
        gameId,
        new GameInfo(playerOne, playerTwo, 1, false),
      );
      expect(() =>
        service.findGameInfo(spectatorOne.userId, gameId),
      ).toThrowError(ForbiddenException);
    });

    it('should not throw FORBIDDEN when the spectator of a ladder game is blocked by either of the players', async () => {
      await userRelationshipStorage.blockUser(
        playerOne.userId,
        spectatorOne.userId,
      );
      gameStorage.games.set(
        gameId,
        new GameInfo(playerOne, playerTwo, 1, true),
      );
      expect(() =>
        service.findGameInfo(spectatorOne.userId, gameId),
      ).not.toThrowError(ForbiddenException);
    });
  });
});
