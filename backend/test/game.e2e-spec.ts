import { DataSource } from 'typeorm';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Socket, io } from 'socket.io-client';
import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { faker } from '@faker-js/faker';
import { nanoid } from 'nanoid';
import * as request from 'supertest';
import waitForExpect from 'wait-for-expect';

import { ActivityManager } from '../src/user-status/activity.manager';
import { AppModule } from '../src/app.module';
import { BlockedUsers } from '../src/entity/blocked-users.entity';
import { GameGateway } from '../src/game/game.gateway';
import { GameInfo, UserId } from '../src/util/type';
import { GameOptionDto, NewGameDto } from '../src/game/dto/game-gateway.dto';
import { GameStorage } from '../src/game/game.storage';
import { LadderQueueInterceptor } from '../src/game/interceptor/ladder-queue.interceptor';
import {
  TYPEORM_SHARED_CONFIG,
  createDataSources,
  destroyDataSources,
} from './util/db-resource-manager';
import { UserRelationshipStorage } from '../src/user-status/user-relationship.storage';
import { Users } from '../src/entity/users.entity';
import { generateUsers } from './util/generate-mock-data';
import { listenPromise, timeout } from './util/util';

const TEST_DB = 'test_db_game_e2e';
const ENTITIES = [BlockedUsers, Users];

const PORT = 4249;
const URL = `http://localhost:${PORT}`;

process.env.NODE_ENV = 'development';
process.env.DB_HOST = 'localhost';

describe('GameController (e2e)', () => {
  let app: INestApplication;
  let activityManager: ActivityManager;
  let clientSockets: Socket[];
  let gameGateway: GameGateway;
  let gameStorage: GameStorage;
  let userRelationshipStorage: UserRelationshipStorage;
  let dataSource: DataSource;
  let initDataSource: DataSource;
  let usersEntities: Users[];
  let users: Users[];
  let userIds: UserId[];
  let index = 0;

  beforeAll(async () => {
    const dataSources = await createDataSources(TEST_DB, ENTITIES);
    initDataSource = dataSources.initDataSource;
    dataSource = dataSources.dataSource;
    usersEntities = generateUsers(200);
    await dataSource.manager.save(usersEntities);
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
    activityManager = app.get(ActivityManager);
    gameGateway = app.get(GameGateway);
    gameStorage = app.get(GameStorage);
    userRelationshipStorage = app.get(UserRelationshipStorage);
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
    await app.listen(PORT);
  });

  beforeEach(async () => {
    users = usersEntities.slice(index, index + 4);
    index += 4;
    userIds = users.map(({ userId }) => userId);
    clientSockets = await Promise.all(
      userIds.map((id) => {
        const socket = io(URL, {
          extraHeaders: { 'x-user-id': id.toString() },
        });
        return listenPromise(socket, 'connect').then(() => socket);
      }),
    );
    clientSockets.forEach((socket) =>
      socket.emit('currentUi', { ui: 'profile' }),
    );
    await waitForExpect(() => {
      userIds.forEach((id) =>
        expect(activityManager.getActivity(id)).toBe('profile'),
      );
    });
  });

  afterEach(() => clientSockets.forEach((socket) => socket.disconnect()));

  afterAll(async () => {
    await new Promise((resolve) => setTimeout(resolve, 300));
    await app.close();
    await destroyDataSources(TEST_DB, dataSource, initDataSource);
  });

  /*****************************************************************************
   *                                                                           *
   * SECTION : Waiting room                                                    *
   *                                                                           *
   ****************************************************************************/

  /*****************************************************************************
   *                                                                           *
   * ANCHOR : GET /game/list                                                   *
   *                                                                           *
   ****************************************************************************/

  describe('GET /game/list', () => {
    it('should return an empty list (200)', () => {
      return request(app.getHttpServer())
        .get('/game/list')
        .set('x-user-id', userIds[0].toString())
        .expect(200)
        .expect({ games: [] });
    });

    it('should return a list of ladder games (200)', async () => {
      const games = [];
      for (let i = index; i < 25; i++) {
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
      index += 50;
      return request(app.getHttpServer())
        .get('/game/list')
        .set('x-user-id', userIds[0].toString())
        .expect(200)
        .expect({ games: games.reverse() });
    });
  });

  /*****************************************************************************
   *                                                                           *
   * ANCHOR : GET /game/list/:gameId                                           *
   *                                                                           *
   ****************************************************************************/

  describe('GET /game/list/:gameId', () => {
    it("should return a ladder game's info (200)", async () => {
      const [playerOne, playerTwo, spectator] = userIds;
      const gameId = nanoid();
      await gameStorage.createGame(
        gameId,
        new GameInfo(playerOne, playerTwo, 0, true),
      );
      const { status, body } = await request(app.getHttpServer())
        .get(`/game/list/${gameId}`)
        .set('x-user-id', spectator.toString());
      expect(status).toBe(200);
      expect(body).toEqual({
        isRank: true,
        leftPlayer: users[0].nickname,
        rightPlayer: users[1].nickname,
        mode: 0,
      });
      await waitForExpect(() => {
        expect(
          (gameGateway as any).server
            .in(`game-${gameId}`)
            .fetchSockets()
            .then((sockets) => sockets.map(({ id }) => id)),
        ).resolves.toContain(clientSockets[2].id);
      });
    });

    it("should return a normal game's info (200)", async () => {
      const [playerOne, playerTwo, spectator] = userIds;
      const gameId = nanoid();
      await gameStorage.createGame(
        gameId,
        new GameInfo(playerOne, playerTwo, 0, false),
      );
      const { status, body } = await request(app.getHttpServer())
        .get(`/game/list/${gameId}`)
        .set('x-user-id', spectator.toString());
      expect(status).toBe(200);
      expect(body).toEqual({
        isRank: false,
        leftPlayer: users[0].nickname,
        rightPlayer: users[1].nickname,
        mode: 0,
      });
      await waitForExpect(() => {
        expect(
          (gameGateway as any).server
            .in(`game-${gameId}`)
            .fetchSockets()
            .then((sockets) => sockets.map(({ id }) => id)),
        ).resolves.toContain(clientSockets[2].id);
      });
    });

    it('should throw BAD REQUEST if the game id is invalid (400)', async () => {
      (
        await Promise.allSettled([
          request(app.getHttpServer())
            .get(`/game/list/invalid`)
            .set('x-user-id', userIds[0].toString())
            .expect(400),
          request(app.getHttpServer())
            .get(`/game/list/${nanoid(22)}`)
            .set('x-user-id', userIds[0].toString())
            .expect(400),
          request(app.getHttpServer())
            .get(`/game/list/${nanoid(10) + '*' + nanoid(10)}`)
            .set('x-user-id', userIds[0].toString())
            .expect(400),
        ])
      ).forEach((result) => expect(result.status).toBe('fulfilled'));
    });

    it('should throw FORBIDDEN if the spectator to a normal game is either a blocker to or blocked by either of the players (403)', async () => {
      const [playerOne, playerTwo, spectatorOne, spectatorTwo] = userIds;
      const gameId = nanoid();
      await Promise.all([
        gameStorage.createGame(
          gameId,
          new GameInfo(playerOne, playerTwo, 1, false),
        ),
        userRelationshipStorage.blockUser(userIds[0], userIds[2]),
        userRelationshipStorage.blockUser(userIds[3], userIds[1]),
      ]);
      (
        await Promise.allSettled([
          request(app.getHttpServer())
            .get(`/game/list/${gameId}`)
            .set('x-user-id', spectatorOne.toString())
            .expect(403),
          request(app.getHttpServer())
            .get(`/game/list/${gameId}`)
            .set('x-user-id', spectatorTwo.toString())
            .expect(403),
        ])
      ).forEach((result) => expect(result.status).toBe('fulfilled'));
    });

    it('should throw NOT FOUND if the game does not exist (404)', () => {
      return request(app.getHttpServer())
        .get(`/game/list/${nanoid()}`)
        .set('x-user-id', userIds[0].toString())
        .expect(404);
    });
  });

  /*****************************************************************************
   *                                                                           *
   * ANCHOR : POST /game/queue                                                 *
   *                                                                           *
   ****************************************************************************/

  describe('POST /game/queue', () => {
    it('should queue the user for a ladder game (201)', async () => {
      const [playerOne, playerTwo] = userIds;
      const [wsMessageOne, wsMessageTwo] = await Promise.all([
        listenPromise<NewGameDto>(clientSockets[0], 'newGame'),
        listenPromise<NewGameDto>(clientSockets[1], 'newGame'),
        request(app.getHttpServer())
          .post('/game/queue')
          .set('x-user-id', playerOne.toString())
          .expect(201),
        request(app.getHttpServer())
          .post('/game/queue')
          .set('x-user-id', playerTwo.toString())
          .expect(201),
      ]);
      const gameId = wsMessageOne?.gameId;
      expect(gameId).toMatch(/^[a-zA-Z0-9_-]{21}$/);
      expect(gameId).toEqual(wsMessageTwo?.gameId);
    });

    it('should throw BAD REQUEST if the user is already playing a game (400', async () => {
      const [playerOne, playerTwo] = userIds;
      await gameStorage.createGame(
        nanoid(),
        new GameInfo(playerOne, playerTwo, 1, false),
      );
      await request(app.getHttpServer())
        .post('/game/queue')
        .set('x-user-id', playerOne.toString())
        .expect(400);
    });

    it('should throw CONFLICT if the user is already in the queue (409)', async () => {
      const [playerOne, playerTwo] = userIds;
      await request(app.getHttpServer())
        .post('/game/queue')
        .set('x-user-id', playerOne.toString())
        .expect(201);
      await request(app.getHttpServer())
        .post('/game/queue')
        .set('x-user-id', playerOne.toString())
        .expect(409);
      await request(app.getHttpServer())
        .post('/game/queue')
        .set('x-user-id', playerTwo.toString())
        .expect(201);
    });
  });

  /*****************************************************************************
   *                                                                           *
   * ANCHOR : DELETE /game/queue                                               *
   *                                                                           *
   ****************************************************************************/

  describe('DELETE /game/queue', () => {
    it('should remove the user from the queue (204)', async () => {
      const ladderQueueInterceptor = app.get(LadderQueueInterceptor);
      const [playerOne, playerTwo, playerThree] = userIds;
      await request(app.getHttpServer())
        .post('/game/queue')
        .set('x-user-id', playerOne.toString())
        .expect(201);
      await waitForExpect(() => {
        expect(
          (ladderQueueInterceptor as any).usersInQueue.has(playerOne),
        ).toBeTruthy();
      });
      await request(app.getHttpServer())
        .delete('/game/queue')
        .set('x-user-id', playerOne.toString())
        .expect(204);
      await waitForExpect(() => {
        expect(
          (ladderQueueInterceptor as any).usersInQueue.has(playerOne),
        ).toBeFalsy();
      });
      const [wsMessageOne, wsMessageTwo] = await Promise.all([
        listenPromise<NewGameDto>(clientSockets[1], 'newGame'),
        listenPromise<NewGameDto>(clientSockets[2], 'newGame'),
        request(app.getHttpServer())
          .post('/game/queue')
          .set('x-user-id', playerTwo.toString())
          .expect(201),
        request(app.getHttpServer())
          .post('/game/queue')
          .set('x-user-id', playerThree.toString())
          .expect(201),
      ]);
      const gameId = wsMessageOne?.gameId;
      expect(gameId).toMatch(/^[a-zA-Z0-9_-]{21}$/);
      expect(gameId).toEqual(wsMessageTwo?.gameId);
    });

    it('should throw NOT FOUND if the user is not in the queue (404)', async () => {
      const [playerOne] = userIds;
      await request(app.getHttpServer())
        .delete('/game/queue')
        .set('x-user-id', playerOne.toString())
        .expect(404);
    });
  });

  /*****************************************************************************
   *                                                                           *
   * SECTION : Game UI                                                         *
   *                                                                           *
   ****************************************************************************/

  /*****************************************************************************
   *                                                                           *
   * ANCHOR : GET /game/:gameId                                                *
   *                                                                           *
   ****************************************************************************/

  describe('GET /game/:gameId', () => {
    it("should return normal game players' info (200)", async () => {
      const [playerOne, playerTwo] = userIds;
      const gameId = nanoid();
      await gameStorage.createGame(
        gameId,
        new GameInfo(playerOne, playerTwo, 1, false),
      );
      const results = await Promise.all([
        request(app.getHttpServer())
          .get(`/game/${gameId}`)
          .set('x-user-id', playerOne.toString())
          .expect(200),
        request(app.getHttpServer())
          .get(`/game/${gameId}`)
          .set('x-user-id', playerTwo.toString())
          .expect(200),
      ]);
      expect(results[0].body).toEqual({
        isRank: false,
        isLeft: true,
        playerId: playerOne,
        playerNickname: users[0].nickname,
        opponentId: playerTwo,
        opponentNickname: users[1].nickname,
      });
      expect(results[1].body).toEqual({
        isRank: false,
        isLeft: false,
        playerId: playerTwo,
        playerNickname: users[1].nickname,
        opponentId: playerOne,
        opponentNickname: users[0].nickname,
      });
    });

    it("should return ladder game players' info (200)", async () => {
      const [playerOne, playerTwo] = userIds;
      const gameId = nanoid();
      await gameStorage.createGame(
        gameId,
        new GameInfo(playerOne, playerTwo, 0, true),
      );
      const results = await Promise.all([
        request(app.getHttpServer())
          .get(`/game/${gameId}`)
          .set('x-user-id', playerOne.toString())
          .expect(200),
        request(app.getHttpServer())
          .get(`/game/${gameId}`)
          .set('x-user-id', playerTwo.toString())
          .expect(200),
      ]);
      expect(results[0].body).toEqual({
        isRank: true,
        isLeft: true,
        playerId: playerOne,
        playerNickname: users[0].nickname,
        opponentId: playerTwo,
        opponentNickname: users[1].nickname,
      });
      expect(results[1].body).toEqual({
        isRank: true,
        isLeft: false,
        playerId: playerTwo,
        playerNickname: users[1].nickname,
        opponentId: playerOne,
        opponentNickname: users[0].nickname,
      });
    });

    it('should throw FORBIDDEN if the user is not a player of the game (403)', async () => {
      const [playerOne, playerTwo, spectator] = userIds;
      const gameId = nanoid();
      await gameStorage.createGame(
        gameId,
        new GameInfo(playerOne, playerTwo, 1, false),
      );
      await request(app.getHttpServer())
        .get(`/game/${gameId}`)
        .set('x-user-id', spectator.toString())
        .expect(403);
    });

    it('should throw NOT FOUND if the game does not exist (404)', async () => {
      const [playerOne] = userIds;
      await request(app.getHttpServer())
        .get('/game/unknownGameunknownGam')
        .set('x-user-id', playerOne.toString())
        .expect(404);
    });
  });

  /*****************************************************************************
   *                                                                           *
   * ANCHOR : PATCH /game/:gameId/options                                      *
   *                                                                           *
   ****************************************************************************/

  describe('PATCH /game/:gameId/options', () => {
    it('should change the mode of a normal game (200)', async () => {
      const [playerOne, playerTwo, spectator] = userIds;
      const gameId = nanoid();
      await gameStorage.createGame(
        gameId,
        new GameInfo(playerOne, playerTwo, 1, false),
      );
      clientSockets[0].emit('currentUi', { ui: `game-${gameId}` });
      clientSockets[1].emit('currentUi', { ui: `game-${gameId}` });
      clientSockets[2].emit('currentUi', { ui: `game-${gameId}` });
      await waitForExpect(() => {
        expect(activityManager.getActivity(playerOne)).toBe(`game-${gameId}`);
        expect(activityManager.getActivity(playerTwo)).toBe(`game-${gameId}`);
        expect(activityManager.getActivity(spectator)).toBe(`game-${gameId}`);
      });
      const [wsError, wsMessageOne, wsMessageTwo] = await Promise.allSettled([
        timeout(500, listenPromise(clientSockets[0], 'gameOption')),
        listenPromise<GameOptionDto>(clientSockets[1], 'gameOption'),
        listenPromise<GameOptionDto>(clientSockets[2], 'gameOption'),
        request(app.getHttpServer())
          .patch(`/game/${gameId}/options`)
          .set('x-user-id', playerOne.toString())
          .send({ mode: 2 })
          .expect(204),
      ]);
      expect(wsError.status).toBe('rejected');
      if (
        wsMessageOne.status === 'rejected' ||
        wsMessageTwo.status === 'rejected'
      ) {
        fail();
      }
      expect(gameStorage.getGame(gameId).mode).toBe(2);
      expect(wsMessageOne.value.mode).toBe(2);
      expect(wsMessageTwo.value.mode).toBe(2);
    });

    it('should throw BAD REQUEST if the user is not in the game UI (400)', async () => {
      const [playerOne, playerTwo] = userIds;
      const gameId = nanoid();
      await gameStorage.createGame(
        gameId,
        new GameInfo(playerOne, playerTwo, 1, false),
      );
      await request(app.getHttpServer())
        .patch(`/game/${gameId}/options`)
        .set('x-user-id', playerOne.toString())
        .send({ mode: 2 })
        .expect(400);
    });

    it('should throw BAD REQUEST if the game is a ladder game (400)', async () => {
      const [playerOne, playerTwo] = userIds;
      const gameId = nanoid();
      await gameStorage.createGame(
        gameId,
        new GameInfo(playerOne, playerTwo, 0, true),
      );
      clientSockets[0].emit('currentUi', { ui: `game-${gameId}` });
      clientSockets[1].emit('currentUi', { ui: `game-${gameId}` });
      await waitForExpect(() => {
        expect(activityManager.getActivity(playerOne)).toBe(`game-${gameId}`);
        expect(activityManager.getActivity(playerTwo)).toBe(`game-${gameId}`);
      });
      await request(app.getHttpServer())
        .patch(`/game/${gameId}/options`)
        .set('x-user-id', playerOne.toString())
        .send({ mode: 2 })
        .expect(400);
    });

    it('should throw FORBIDDEN if the user is not a player of the game (403)', async () => {
      const [playerOne, playerTwo, spectator] = userIds;
      const gameId = nanoid();
      await gameStorage.createGame(
        gameId,
        new GameInfo(playerOne, playerTwo, 1, false),
      );
      clientSockets[0].emit('currentUi', { ui: `game-${gameId}` });
      clientSockets[1].emit('currentUi', { ui: `game-${gameId}` });
      clientSockets[2].emit('currentUi', { ui: `game-${gameId}` });
      await waitForExpect(() => {
        expect(activityManager.getActivity(playerOne)).toBe(`game-${gameId}`);
        expect(activityManager.getActivity(playerTwo)).toBe(`game-${gameId}`);
        expect(activityManager.getActivity(spectator)).toBe(`game-${gameId}`);
      });
      await request(app.getHttpServer())
        .patch(`/game/${gameId}/options`)
        .set('x-user-id', spectator.toString())
        .send({ mode: 2 })
        .expect(403);
    });

    it('should throw FORBIDDEN if the requester is not the inviter (403)', async () => {
      const [playerOne, playerTwo] = userIds;
      const gameId = nanoid();
      await gameStorage.createGame(
        gameId,
        new GameInfo(playerOne, playerTwo, 1, false),
      );
      clientSockets[0].emit('currentUi', { ui: `game-${gameId}` });
      clientSockets[1].emit('currentUi', { ui: `game-${gameId}` });
      await waitForExpect(() => {
        expect(activityManager.getActivity(playerOne)).toBe(`game-${gameId}`);
        expect(activityManager.getActivity(playerTwo)).toBe(`game-${gameId}`);
      });
      await request(app.getHttpServer())
        .patch(`/game/${gameId}/options`)
        .set('x-user-id', playerTwo.toString())
        .send({ mode: 2 })
        .expect(403);
    });

    it('should throw NOT FOUND if the game does not exist (404)', async () => {
      const [playerOne] = userIds;
      clientSockets[0].emit('currentUi', { ui: 'game-unknownGameunknownGam' });
      await waitForExpect(() => {
        expect(activityManager.getActivity(playerOne)).toBe(
          'game-unknownGameunknownGam',
        );
      });
      await request(app.getHttpServer())
        .patch('/game/unknownGameunknownGam/options')
        .set('x-user-id', playerOne.toString())
        .send({ mode: 2 })
        .expect(404);
    });
  });

  /*****************************************************************************
   *                                                                           *
   * ANCHOR : PATCH /game/:gameId/start                                        *
   * NOTE : SKIPPED                                                            *
   *                                                                           *
   ****************************************************************************/

  describe.skip('PATCH /game/:gameId/start', () => {
    it('should start the game when the both players sends the request (200)', async () => {
      const [playerOne, playerTwo, spectator, waitingRoom] = userIds;
      const gameId = nanoid();
      await gameStorage.createGame(
        gameId,
        new GameInfo(playerOne, playerTwo, 1, false),
      );
      await request(app.getHttpServer())
        .get(`/game/list/${gameId}/`)
        .set('x-user-id', spectator.toString())
        .expect(200);
      clientSockets[0].emit('currentUi', { ui: `game-${gameId}` });
      clientSockets[1].emit('currentUi', { ui: `game-${gameId}` });
      clientSockets[2].emit('currentUi', { ui: `game-${gameId}` });
      clientSockets[3].emit('currentUi', { ui: 'waitingRoom' });
      await waitForExpect(() => {
        expect(activityManager.getActivity(playerOne)).toBe(`game-${gameId}`);
        expect(activityManager.getActivity(playerTwo)).toBe(`game-${gameId}`);
        expect(activityManager.getActivity(spectator)).toBe(`game-${gameId}`);
        expect(activityManager.getActivity(waitingRoom)).toBe('waitingRoom');
      });
      const [wsMessage] = await Promise.all([
        listenPromise(clientSockets[3], 'gameStarted'),
        request(app.getHttpServer())
          .patch(`/game/${gameId}/start`)
          .set('x-user-id', playerOne.toString())
          .expect(204),
        request(app.getHttpServer())
          .patch(`/game/${gameId}/start`)
          .set('x-user-id', playerTwo.toString())
          .expect(204),
      ]);
      expect(wsMessage).toEqual({
        id: gameId,
        left: users[0].nickname,
        right: users[1].nickname,
      });
      expect(gameStorage.getGame(gameId).isStarted).toBeTruthy();
    });

    it('should throw BAD REQUEST when the gameId is invalid (400)', () => {
      const [playerOne] = userIds;
      return request(app.getHttpServer())
        .patch('/game/invalidGameId/start')
        .set('x-user-id', playerOne.toString())
        .expect(400);
    });

    it('should throw BAD REQUEST when a user tries to restart the game that is already in progress', async () => {
      const [playerOne, playerTwo] = userIds;
      const gameId = nanoid();
      await gameStorage.createGame(
        gameId,
        new GameInfo(playerOne, playerTwo, 1, false),
      );
      clientSockets[0].emit('currentUi', { ui: `game-${gameId}` });
      clientSockets[1].emit('currentUi', { ui: `game-${gameId}` });
      gameStorage.getGame(gameId).isStarted = true;
      return request(app.getHttpServer())
        .patch(`/game/${gameId}/start`)
        .set('x-user-id', playerOne.toString())
        .expect(400);
    });

    it('should throw FORBIDDEN when the requester is not a player (403)', async () => {
      const [playerOne, playerTwo, spectator] = userIds;
      const gameId = nanoid();
      await gameStorage.createGame(
        gameId,
        new GameInfo(playerOne, playerTwo, 1, false),
      );
      clientSockets[0].emit('currentUi', { ui: `game-${gameId}` });
      clientSockets[1].emit('currentUi', { ui: `game-${gameId}` });
      clientSockets[2].emit('currentUi', { ui: `game-${gameId}` });
      await waitForExpect(() => {
        expect(activityManager.getActivity(playerOne)).toBe(`game-${gameId}`);
        expect(activityManager.getActivity(playerTwo)).toBe(`game-${gameId}`);
        expect(activityManager.getActivity(spectator)).toBe(`game-${gameId}`);
      });
      return request(app.getHttpServer())
        .patch(`/game/${gameId}/start`)
        .set('x-user-id', spectator.toString())
        .expect(403);
    });

    it('should throw NOT FOUND if the game does not exist (404)', async () => {
      const [playerOne] = userIds;
      clientSockets[0].emit('currentUi', { ui: 'game-unknownGameunknownGam' });
      await waitForExpect(() => {
        expect(activityManager.getActivity(playerOne)).toBe(
          'game-unknownGameunknownGam',
        );
      });
      return request(app.getHttpServer())
        .patch('/game/unknownGameunknownGam/start')
        .set('x-user-id', playerOne.toString())
        .expect(404);
    });

    it('should throw CONFLICT if the user has already entered the game start queue', async () => {
      const [playerOne, playerTwo] = userIds;
      const gameId = nanoid();
      await gameStorage.createGame(
        gameId,
        new GameInfo(playerOne, playerTwo, 1, false),
      );
      clientSockets[0].emit('currentUi', { ui: `game-${gameId}` });
      clientSockets[1].emit('currentUi', { ui: `game-${gameId}` });
      await waitForExpect(() => {
        expect(activityManager.getActivity(playerOne)).toBe(`game-${gameId}`);
        expect(activityManager.getActivity(playerTwo)).toBe(`game-${gameId}`);
      });
      await request(app.getHttpServer())
        .patch(`/game/${gameId}/start`)
        .set('x-user-id', playerOne.toString())
        .expect(204);
      return request(app.getHttpServer())
        .patch(`/game/${gameId}/start`)
        .set('x-user-id', playerOne.toString())
        .expect(409);
    });

    it('should throw error when the other user does not join the game start queue in a certain amount of time', async () => {
      const [playerOne, playerTwo, spectator] = userIds;
      const gameId = nanoid();
      await gameStorage.createGame(
        gameId,
        new GameInfo(playerOne, playerTwo, 1, false),
      );
      clientSockets[0].emit('currentUi', { ui: `game-${gameId}` });
      clientSockets[1].emit('currentUi', { ui: `game-${gameId}` });
      clientSockets[2].emit('currentUi', { ui: `game-${gameId}` });
      await waitForExpect(() => {
        expect(activityManager.getActivity(playerOne)).toBe(`game-${gameId}`);
        expect(activityManager.getActivity(playerTwo)).toBe(`game-${gameId}`);
        expect(activityManager.getActivity(spectator)).toBe(`game-${gameId}`);
      });
      await request(app.getHttpServer())
        .patch(`/game/${gameId}/start`)
        .set('x-user-id', playerOne.toString())
        .expect(204);
      const [wsError, wsSuccessOne, wsSuccessTwo, wsSuccessThree] =
        await Promise.allSettled([
          timeout(1200, listenPromise(clientSockets[0], 'gameStatus')),
          listenPromise(clientSockets[0], 'gameCancelled'),
          listenPromise(clientSockets[1], 'gameCancelled'),
          listenPromise(clientSockets[2], 'gameCancelled'),
          request(app.getHttpServer())
            .patch(`/game/${gameId}/start`)
            .set('x-user-id', playerOne.toString())
            .expect(204),
        ]);
      expect(wsError.status).toBe('rejected');
      expect(wsSuccessOne.status).toBe('fulfilled');
      expect(wsSuccessTwo.status).toBe('fulfilled');
      expect(wsSuccessThree.status).toBe('fulfilled');
      await request(app.getHttpServer())
        .patch(`/game/${gameId}/start`)
        .set('x-user-id', playerTwo.toString())
        .expect(404);
    });
  });
});
