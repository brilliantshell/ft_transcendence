import { DataSource } from 'typeorm';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { nanoid } from 'nanoid';

import { BlockedUsers } from '../entity/blocked-users.entity';
import { Channels } from '../entity/channels.entity';
import { Friends } from '../entity/friends.entity';
import { GameGateway } from './game.gateway';
import { GameId, GameInfo, SocketId } from '../util/type';
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

  beforeAll(async () => {
    const dataSources = await createDataSources(TEST_DB, ENTITIES);
    initDataSource = dataSources.initDataSource;
    dataSource = dataSources.dataSource;
    usersEntities = generateUsers(100);
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
        emitNewGame: jest.fn((gameId: GameId) => undefined),
        emitGameOption: jest.fn((socketId: SocketId, map: number) => undefined),
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
    currentUsers = usersEntities.slice(index, index + 3);
    [playerOne, playerTwo, spectatorOne] = currentUsers;
    await Promise.all(
      currentUsers.map(({ userId }) => {
        const socketId = nanoid();
        userSocketStorage.clients.set(userId, socketId);
        userSocketStorage.sockets.set(socketId, userId);
        return userRelationshipStorage.load(userId);
      }),
    );
    index += 3;
  });

  afterEach(async () => {
    await Promise.all(
      currentUsers.map(({ userId }) => userRelationshipStorage.unload(userId)),
    );
    (gameStorage as any).games.clear();
  });

  afterAll(
    async () => await destroyDataSources(TEST_DB, dataSource, initDataSource),
  );

  describe('GAME LIST', () => {
    it('should return an empty list of games', () => {
      expect(service.findGames()).toEqual([]);
    });

    it('should return a list of games', async () => {
      const games = [];
      for (let i = index; i < 10; i++) {
        const newGameId = nanoid();
        await gameStorage.createGame(
          newGameId,
          new GameInfo(
            usersEntities[i].userId,
            usersEntities[i + 1].userId,
            1,
            true,
          ),
        );
        games.push({
          id: newGameId,
          left: usersEntities[i].nickname,
          right: usersEntities[i + 1].nickname,
        });
      }
      index += 10;
      expect(service.findGames()).toEqual(games.reverse());
    });
  });

  describe('SPECTATOR', () => {
    it('should return game information when a user tries to spectate a game', async () => {
      await gameStorage.createGame(
        gameId,
        new GameInfo(playerOne.userId, playerTwo.userId, 1, true),
      );
      expect(service.findGameInfo(spectatorOne.userId, gameId)).toEqual({
        leftPlayer: playerOne.nickname,
        rightPlayer: playerTwo.nickname,
        map: 1,
      });
    });

    it("should put the spectator's socket into the game's WebSocket room", async () => {
      await gameStorage.createGame(
        gameId,
        new GameInfo(playerOne.userId, playerTwo.userId, 1, true),
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
      await gameStorage.createGame(
        gameId,
        new GameInfo(playerOne.userId, playerTwo.userId, 1, false),
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
      await gameStorage.createGame(
        gameId,
        new GameInfo(playerOne.userId, playerTwo.userId, 1, true),
      );
      expect(() =>
        service.findGameInfo(spectatorOne.userId, gameId),
      ).not.toThrowError(ForbiddenException);
    });
  });

  describe('CREATE NORMAL GAME', () => {
    it('should create a new normal game and notify the invited player', async () => {
      const newGameId = await service.createNormalGame(
        playerOne.userId,
        playerTwo.userId,
      );
      expect(gameStorage.getGame(newGameId)).toMatchObject({
        leftId: playerOne.userId,
        leftNickname: playerOne.nickname,
        rightId: playerTwo.userId,
        rightNickname: playerTwo.nickname,
        map: 1,
        isRank: false,
      });
      expect(gameGateway.emitNewGame).toHaveBeenCalledWith(newGameId);
      expect(gameGateway.joinRoom).toHaveBeenCalledTimes(2);
      expect(gameGateway.joinRoom).toHaveBeenCalledWith(
        userSocketStorage.clients.get(playerOne.userId),
        `game-${newGameId}`,
      );
      expect(gameGateway.joinRoom).toHaveBeenCalledWith(
        userSocketStorage.clients.get(playerTwo.userId),
        `game-${newGameId}`,
      );
    });

    it('should throw CONFLICT when the invited is already in a game', async () => {
      await gameStorage.createGame(
        gameId,
        new GameInfo(playerOne.userId, playerTwo.userId, 1, false),
      );
      expect(async () =>
        service.createNormalGame(spectatorOne.userId, playerTwo.userId),
      ).rejects.toThrowError(ConflictException);
      expect(gameGateway.joinRoom).not.toHaveBeenCalled();
      expect(gameGateway.emitNewGame).not.toHaveBeenCalled();
    });

    it('should throw BAD REQUEST when the inviter is already in a game', async () => {
      await gameStorage.createGame(
        gameId,
        new GameInfo(playerOne.userId, spectatorOne.userId, 1, false),
      );
      expect(async () =>
        service.createNormalGame(playerOne.userId, playerTwo.userId),
      ).rejects.toThrowError(BadRequestException);
      expect(gameGateway.joinRoom).not.toHaveBeenCalled();
      expect(gameGateway.emitNewGame).not.toHaveBeenCalled();
    });
  });

  describe('CHANGE MAP', () => {
    it('should change the map of a game and let the opponent know the updated option', async () => {
      await gameStorage.createGame(
        gameId,
        new GameInfo(playerOne.userId, playerTwo.userId, 1, false),
      );
      service.changeMap(playerOne.userId, gameId, 2);
      expect(gameStorage.getGame(gameId).map).toBe(2);
      expect(gameGateway.emitGameOption).toHaveBeenCalledWith(
        userSocketStorage.clients.get(playerTwo.userId),
        2,
      );
    });

    it('should throw NOT FOUND when the game does not exist', () => {
      expect(() => service.changeMap(playerOne.userId, gameId, 2)).toThrowError(
        NotFoundException,
      );
      expect(gameGateway.emitGameOption).not.toHaveBeenCalled();
    });

    it('should throw FORBIDDEN when the player is not in the game', async () => {
      await gameStorage.createGame(
        gameId,
        new GameInfo(playerOne.userId, playerTwo.userId, 1, false),
      );
      expect(() =>
        service.changeMap(spectatorOne.userId, gameId, 2),
      ).toThrowError(ForbiddenException);
      expect(gameGateway.emitGameOption).not.toHaveBeenCalled();
    });

    it('should throw FORBIDDEN when the player did not create the game', async () => {
      await gameStorage.createGame(
        gameId,
        new GameInfo(playerOne.userId, playerTwo.userId, 1, false),
      );
      expect(() => service.changeMap(playerTwo.userId, gameId, 2)).toThrowError(
        ForbiddenException,
      );
      expect(gameGateway.emitGameOption).not.toHaveBeenCalled();
    });

    it('should throw FORBIDDEN when the game is a ladder game', async () => {
      await gameStorage.createGame(
        gameId,
        new GameInfo(playerOne.userId, playerTwo.userId, 1, true),
      );
      expect(() => service.changeMap(playerOne.userId, gameId, 2)).toThrowError(
        ForbiddenException,
      );
      expect(gameGateway.emitGameOption).not.toHaveBeenCalled();
    });
  });

  describe('START THE GAME', () => {
    it("should return pleyer's info and on which side they are", async () => {
      await gameStorage.createGame(
        gameId,
        new GameInfo(playerOne.userId, playerTwo.userId, 1, false),
      );
      expect(service.findPlayers(playerOne.userId, gameId)).toEqual({
        isLeft: true,
        playerId: playerOne.userId,
        playerNickname: playerOne.nickname,
        opponentId: playerTwo.userId,
        opponentNickname: playerTwo.nickname,
      });
    });

    it('should throw NOT FOUND when the game does not exist', () => {
      expect(() => service.findPlayers(playerOne.userId, gameId)).toThrowError(
        NotFoundException,
      );
    });

    it('should throw FORBIDDEN when the player is not in the game', async () => {
      await gameStorage.createGame(
        gameId,
        new GameInfo(playerOne.userId, playerTwo.userId, 1, false),
      );
      expect(() =>
        service.findPlayers(spectatorOne.userId, gameId),
      ).toThrowError(ForbiddenException);
    });
  });
});
