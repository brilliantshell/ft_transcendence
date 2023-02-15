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
import { GameStorage } from '../src/game/game.storage';
import { NewGameDto } from '../src/game/dto/game-gateway.dto';
import {
  TYPEORM_SHARED_CONFIG,
  createDataSources,
  destroyDataSources,
} from './util/db-resource-manager';
import { UserRelationshipStorage } from '../src/user-status/user-relationship.storage';
import { Users } from '../src/entity/users.entity';
import { generateUsers } from './util/generate-mock-data';
import { listenPromise } from './util/util';

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
      userIds.map(async (id) => {
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
            1,
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
        new GameInfo(playerOne, playerTwo, 1, true),
      );
      const { status, body } = await request(app.getHttpServer())
        .get(`/game/list/${gameId}`)
        .set('x-user-id', spectator.toString());
      expect(status).toBe(200);
      expect(body).toEqual({
        leftPlayer: users[0].nickname,
        rightPlayer: users[1].nickname,
        map: 1,
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
        new GameInfo(playerOne, playerTwo, 1, false),
      );
      const { status, body } = await request(app.getHttpServer())
        .get(`/game/list/${gameId}`)
        .set('x-user-id', spectator.toString());
      expect(status).toBe(200);
      expect(body).toEqual({
        leftPlayer: users[0].nickname,
        rightPlayer: users[1].nickname,
        map: 1,
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
      const [playerOne] = userIds;
      await request(app.getHttpServer())
        .post('/game/queue')
        .set('x-user-id', playerOne.toString())
        .expect(201);
      await request(app.getHttpServer())
        .post('/game/queue')
        .set('x-user-id', playerOne.toString())
        .expect(409);
    });
  });

  /*****************************************************************************
   *                                                                           *
   * SECTION : Game UI                                                         *
   *                                                                           *
   ****************************************************************************/
});
