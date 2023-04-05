import { DataSource } from 'typeorm';
import { ForbiddenException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { faker } from '@faker-js/faker';
import { nanoid } from 'nanoid';
import waitForExpect from 'wait-for-expect';

import { ActivityGateway } from '../user-status/activity.gateway';
import { BlockedUsers } from '../entity/blocked-users.entity';
import { Channels } from '../entity/channels.entity';
import { Friends } from '../entity/friends.entity';
import { GameEngine } from './game.engine';
import { GameGateway } from './game.gateway';
import { GameData, GameId, GameInfo, SocketId } from '../util/type';
import { GameService } from './game.service';
import { GameStartedDto } from './dto/game-gateway.dto';
import { GameStorage } from './game.storage';
import { RanksGateway } from '../ranks/ranks.gateway';
import { UserRelationshipStorage } from '../user-status/user-relationship.storage';
import { UserSocketStorage } from '../user-status/user-socket.storage';
import { UserStatusModule } from '../user-status/user-status.module';
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
    usersEntities = generateUsers(200);
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
        UserStatusModule,
      ],
      providers: [
        GameEngine,
        GameGateway,
        GameService,
        GameStorage,
        RanksGateway,
      ],
    })
      .overrideProvider(GameGateway)
      .useValue({
        joinRoom: jest.fn((socketId: string, roomId: string) => undefined),
        emitNewGame: jest.fn((gameId: GameId) => undefined),
        emitNewNormalGame: jest.fn(
          (gameId: GameId, inviterNickname: string) => undefined,
        ),
        emitGameOption: jest.fn(
          (gameId: GameId, socketId: SocketId, mode: number) => undefined,
        ),
        emitGameStarted: jest.fn((gameStarted: GameStartedDto) => undefined),
        emitGameStatus: jest.fn((gameId: GameId) => undefined),
        emitGameCancelled: jest.fn((gameId: GameId) => undefined),
      })
      .overrideProvider(GameEngine)
      .useValue({
        startGame: jest.fn((gameId: GameId, gameData: GameData) => undefined),
      })
      .overrideProvider(ActivityGateway)
      .useValue({
        emitUserActivity: jest.fn((userId: string) => undefined),
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
      expect(service.findLadderGames()).toEqual({ games: [] });
    });

    it('should return a list of ladder games', async () => {
      const games = [];
      for (let i = index; i < 50; i++) {
        const newGameId = nanoid();
        const isRank = faker.datatype.boolean();
        await gameStorage.createGame(
          newGameId,
          new GameInfo(
            usersEntities[i].userId,
            usersEntities[i + 1].userId,
            0,
            isRank,
          ),
        );
        isRank &&
          games.push({
            id: newGameId,
            left: usersEntities[i].nickname,
            right: usersEntities[i + 1].nickname,
          });
      }
      index += 100;
      expect(service.findLadderGames()).toEqual({ games: games.reverse() });
    });
  });

  describe('SPECTATOR', () => {
    it('should return game information when a user tries to spectate a normal game before it starts', async () => {
      const gameInfo = new GameInfo(
        playerOne.userId,
        playerTwo.userId,
        1,
        false,
      );
      await gameStorage.createGame(gameId, gameInfo);
      expect(
        service.findGameInfo(spectatorOne.userId, gameId, gameInfo),
      ).toEqual({
        isRank: false,
        isLeft: false,
        isPlayer: false,
        isStarted: false,
        leftId: playerOne.userId,
        leftNickname: playerOne.nickname,
        rightId: playerTwo.userId,
        rightNickname: playerTwo.nickname,
        mode: 1,
      });
    });

    it('should return game information when a user tries to spectate a game (in progress)', async () => {
      const gameInfo = new GameInfo(
        playerOne.userId,
        playerTwo.userId,
        0,
        true,
      );
      await gameStorage.createGame(gameId, gameInfo);
      expect(
        service.findGameInfo(spectatorOne.userId, gameId, gameInfo),
      ).toEqual({
        isRank: true,
        isLeft: false,
        isPlayer: false,
        isStarted: false,
        leftId: playerOne.userId,
        leftNickname: playerOne.nickname,
        rightId: playerTwo.userId,
        rightNickname: playerTwo.nickname,
        mode: 0,
      });
    });

    it("should put the spectator's socket into the game's WebSocket room", async () => {
      const gameInfo = new GameInfo(
        playerOne.userId,
        playerTwo.userId,
        1,
        true,
      );
      await gameStorage.createGame(gameId, gameInfo);
      service.findGameInfo(spectatorOne.userId, gameId, gameInfo);
      expect(gameGateway.joinRoom).toHaveBeenCalledWith(
        userSocketStorage.clients.get(spectatorOne.userId),
        `game-${gameId}`,
      );
    });

    // NOTE : FORBIDDEN 처리 GUARD 로 이전
    it.skip('should throw FORBIDDEN when the spectator of a normal game is blocked by either of the players', async () => {
      await userRelationshipStorage.blockUser(
        playerOne.userId,
        spectatorOne.userId,
      );
      const gameInfo = new GameInfo(
        playerOne.userId,
        playerTwo.userId,
        1,
        false,
      );
      await gameStorage.createGame(gameId, gameInfo);
      expect(() =>
        service.findGameInfo(spectatorOne.userId, gameId, gameInfo),
      ).toThrowError(ForbiddenException);
    });

    it('should not throw FORBIDDEN when the spectator of a ladder game is blocked by either of the players', async () => {
      await userRelationshipStorage.blockUser(
        playerOne.userId,
        spectatorOne.userId,
      );
      const gameInfo = new GameInfo(
        playerOne.userId,
        playerTwo.userId,
        0,
        true,
      );
      await gameStorage.createGame(gameId, gameInfo);
      expect(() =>
        service.findGameInfo(spectatorOne.userId, gameId, gameInfo),
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
        mode: 0,
        isRank: false,
      });
      expect(gameGateway.emitNewNormalGame).toHaveBeenCalledWith(
        newGameId,
        playerOne.nickname,
      );
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
  });

  describe('CREATE LADDER GAME', () => {
    it('should create a new ladder game and notify the invited player', async () => {
      service.createLadderGame([playerOne.userId, playerTwo.userId]);
      await waitForExpect(() => {
        expect(gameGateway.emitNewGame).toHaveBeenCalled();
        expect(gameGateway.joinRoom).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('CHANGE MAP', () => {
    it('should change the gameMod and let the opponent know the updated option', async () => {
      const gameInfo = new GameInfo(
        playerOne.userId,
        playerTwo.userId,
        1,
        false,
      );
      await gameStorage.createGame(gameId, gameInfo);
      service.changeMode(playerOne.userId, gameId, gameInfo, 2);
      expect(gameStorage.getGame(gameId).mode).toBe(2);
      expect(gameGateway.emitGameOption).toHaveBeenCalledWith(
        gameId,
        userSocketStorage.clients.get(playerOne.userId),
        2,
      );
    });

    it('should throw FORBIDDEN when the player is not in the game', async () => {
      const gameInfo = new GameInfo(
        playerOne.userId,
        playerTwo.userId,
        1,
        false,
      );
      await gameStorage.createGame(gameId, gameInfo);
      expect(() =>
        service.changeMode(spectatorOne.userId, gameId, gameInfo, 2),
      ).toThrowError(ForbiddenException);
      expect(gameGateway.emitGameOption).not.toHaveBeenCalled();
    });

    it('should throw FORBIDDEN when the player did not create the game', async () => {
      const gameInfo = new GameInfo(
        playerOne.userId,
        playerTwo.userId,
        1,
        false,
      );
      await gameStorage.createGame(gameId, gameInfo);
      expect(() =>
        service.changeMode(playerTwo.userId, gameId, gameInfo, 2),
      ).toThrowError(ForbiddenException);
      expect(gameGateway.emitGameOption).not.toHaveBeenCalled();
    });
  });

  describe("GET PLAYERS' INFO", () => {
    it("should return normal game pleyer's info and on which side they are", async () => {
      const gameInfo = new GameInfo(
        playerOne.userId,
        playerTwo.userId,
        1,
        false,
      );
      await gameStorage.createGame(gameId, gameInfo);
      expect(service.findGameInfo(playerOne.userId, gameId, gameInfo)).toEqual({
        isRank: false,
        isPlayer: true,
        isLeft: true,
        isStarted: false,
        leftId: playerOne.userId,
        leftNickname: playerOne.nickname,
        rightId: playerTwo.userId,
        rightNickname: playerTwo.nickname,
        mode: 1,
      });
    });

    it("should return ladder game pleyers' info and on which side they are", async () => {
      const gameInfo = new GameInfo(
        playerOne.userId,
        playerTwo.userId,
        0,
        true,
      );
      await gameStorage.createGame(gameId, gameInfo);
      expect(service.findGameInfo(playerTwo.userId, gameId, gameInfo)).toEqual({
        isRank: true,
        isPlayer: true,
        isLeft: false,
        isStarted: false,
        leftId: playerOne.userId,
        leftNickname: playerOne.nickname,
        rightId: playerTwo.userId,
        rightNickname: playerTwo.nickname,
        mode: 0,
      });
    });
  });

  describe('START GAME', () => {
    it('should send to players & spectators and gameStarted to waitingRoom', async () => {
      await gameStorage.createGame(
        gameId,
        new GameInfo(playerOne.userId, playerTwo.userId, 1, false),
      );
      const gameInfo = gameStorage.getGame(gameId);
      service.startGame(gameId, gameInfo);
      expect(gameGateway.emitGameStarted).toHaveBeenCalledWith({
        id: gameId,
        left: gameInfo.leftNickname,
        right: gameInfo.rightNickname,
      });
    });
  });

  describe('DELETE CANCELLED GAME', () => {
    it('should delete the game and emit gameCancelled to players and spectators', async () => {
      await gameStorage.createGame(
        gameId,
        new GameInfo(playerOne.userId, playerTwo.userId, 1, false),
      );
      service.deleteCancelledGame(gameId);
      expect(gameStorage.getGame(gameId)).toBeUndefined();
      expect(gameGateway.emitGameCancelled).toHaveBeenCalled();
    });
  });
});
