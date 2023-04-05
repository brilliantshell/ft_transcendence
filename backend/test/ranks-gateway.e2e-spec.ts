import { DataSource, In } from 'typeorm';
import { INestApplication } from '@nestjs/common';
import { Socket, io } from 'socket.io-client';
import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { nanoid } from 'nanoid';
import waitForExpect from 'wait-for-expect';

import { ActivityManager } from '../src/user-status/activity.manager';
import { AppModule } from '../src/app.module';
import { GameGateway } from '../src/game/game.gateway';
import { GameInfo, UserId } from '../src/util/type';
import { GameStorage } from '../src/game/game.storage';
import { RanksGateway } from '../src/ranks/ranks.gateway';
import {
  TYPEORM_SHARED_CONFIG,
  createDataSources,
  destroyDataSources,
} from './util/db-resource-manager';
import { Users } from '../src/entity/users.entity';
import { calculateLadderRise, listenPromise, timeout } from './util/util';
import { generateUsers } from './util/generate-mock-data';

const PORT = 4246;
const URL = `http://localhost:${PORT}`;

const TEST_DB = 'test_db_ranks_gateway';
const ENTITIES = [Users];

process.env.NODE_ENV = 'development';
process.env.DB_HOST = 'localhost';

describe('RanksGateway (e2e)', () => {
  let app: INestApplication;
  let clientSockets: Socket[];
  let dataSource: DataSource;
  let initDataSource: DataSource;
  let activityManager: ActivityManager;
  let gateway: RanksGateway;
  let gameStorage: GameStorage;
  let gameGateway: GameGateway;
  let usersEntities: Users[];
  let users: Users[];
  let userIds: UserId[];
  let index = 0;

  beforeAll(async () => {
    const dataSources = await createDataSources(TEST_DB, ENTITIES);
    initDataSource = dataSources.initDataSource;
    dataSource = dataSources.dataSource;
    usersEntities = generateUsers(48);
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
    await app.init();
    await app.listen(PORT);
    gateway = app.get(RanksGateway);
    activityManager = app.get(ActivityManager);
    gameStorage = app.get(GameStorage);
    gameGateway = app.get(GameGateway);
  });

  beforeEach(async () => {
    users = [
      usersEntities[index++],
      usersEntities[index++],
      usersEntities[index++],
      usersEntities[index++],
      usersEntities[index++],
      usersEntities[index++],
    ];
    userIds = users.map(({ userId }) => userId);
    clientSockets = userIds.map((userId) =>
      io(URL, { extraHeaders: { 'x-user-id': userId.toString() } }),
    );
    await Promise.all(
      clientSockets.map((socket) => listenPromise(socket, 'connect')),
    );
  });

  afterEach(() => clientSockets.forEach((socket) => socket.disconnect()));

  afterAll(async () => {
    await app.close();
    await destroyDataSources(TEST_DB, dataSource, initDataSource);
  });

  describe('joinRanksRoom & leaveRanksRoom', () => {
    it('should join the ranks room when the user navigates to the ranks UI', async () => {
      const [userOne] = clientSockets;
      userOne.emit('currentUi', { ui: 'ranks' });
      await waitForExpect(() => {
        expect(activityManager.getActivity(userIds[0])).toBe('ranks');
        expect(gateway.doesRanksRoomExist()).toBeTruthy();
      });
    });

    it('should leave the ranks room when the user leaves the ranks UI', async () => {
      const [userOne] = clientSockets;
      userOne.emit('currentUi', { ui: 'ranks' });
      await waitForExpect(() => {
        expect(activityManager.getActivity(userIds[0])).toBe('ranks');
        expect(gateway.doesRanksRoomExist()).toBeTruthy();
      });
      userOne.emit('currentUi', { ui: 'profile' });
      await waitForExpect(() => {
        expect(activityManager.getActivity(userIds[0])).toBe('profile');
        expect(gateway.doesRanksRoomExist()).toBeFalsy();
      });
    });
  });

  describe('ladderUpdate', () => {
    it('should not notify the users in the ranks UI when a non-ladder game is ended', async () => {
      const gameId = nanoid();
      await gameStorage.createGame(
        gameId,
        new GameInfo(userIds[0], userIds[1], 1, false),
      );
      const [playerOne, playerTwo, ranksOne, ranksTwo, profile, waitingRoom] =
        clientSockets;
      playerOne.emit('currentUi', { ui: `game-${gameId}` });
      playerTwo.emit('currentUi', { ui: `game-${gameId}` });
      ranksOne.emit('currentUi', { ui: 'ranks' });
      ranksTwo.emit('currentUi', { ui: 'ranks' });
      profile.emit('currentUi', { ui: 'profile' });
      waitingRoom.emit('currentUi', { ui: 'waitingRoom' });
      await waitForExpect(() => {
        expect(activityManager.getActivity(userIds[0])).toBe(`game-${gameId}`);
        expect(activityManager.getActivity(userIds[1])).toBe(`game-${gameId}`);
        expect(activityManager.getActivity(userIds[2])).toBe('ranks');
        expect(activityManager.getActivity(userIds[3])).toBe('ranks');
        expect(activityManager.getActivity(userIds[4])).toBe('profile');
        expect(activityManager.getActivity(userIds[5])).toBe('waitingRoom');
      });
      const [
        playerFailOne,
        playerFailTwo,
        profileFail,
        waitingRoomFail,
        ranksFailOne,
        ranksFailTwo,
      ] = await Promise.allSettled([
        timeout(1000, listenPromise(playerOne, 'ladderUpdate')),
        timeout(1000, listenPromise(playerTwo, 'ladderUpdate')),
        timeout(1000, listenPromise(profile, 'ladderUpdate')),
        timeout(1000, listenPromise(waitingRoom, 'ladderUpdate')),
        timeout(1000, listenPromise(ranksOne, 'ladderUpdate')),
        timeout(1000, listenPromise(ranksTwo, 'ladderUpdate')),
        gameGateway.abortIfPlayerLeave(gameId, userIds[0]),
      ]);
      expect(playerFailOne.status).toBe('rejected');
      expect(playerFailTwo.status).toBe('rejected');
      expect(profileFail.status).toBe('rejected');
      expect(waitingRoomFail.status).toBe('rejected');
      expect(ranksFailOne.status).toBe('rejected');
      expect(ranksFailTwo.status).toBe('rejected');
    });

    it('should notify the users in the ranks UI when a ladder game is ended', async () => {
      const prevGame = await dataSource.manager.find(Users, {
        select: ['userId', 'winCount', 'lossCount', 'ladder'],
        where: { userId: In([userIds[0], userIds[1]]) },
      });
      expect(prevGame.length).toBe(2);
      const gameId = nanoid();
      await gameStorage.createGame(
        gameId,
        new GameInfo(userIds[0], userIds[1], 1, true),
      );
      const [playerOne, playerTwo, ranksOne, ranksTwo, profile, waitingRoom] =
        clientSockets;
      playerOne.emit('currentUi', { ui: `game-${gameId}` });
      playerTwo.emit('currentUi', { ui: `game-${gameId}` });
      ranksOne.emit('currentUi', { ui: 'ranks' });
      ranksTwo.emit('currentUi', { ui: 'ranks' });
      profile.emit('currentUi', { ui: 'profile' });
      waitingRoom.emit('currentUi', { ui: 'waitingRoom' });
      await waitForExpect(() => {
        expect(activityManager.getActivity(userIds[0])).toBe(`game-${gameId}`);
        expect(activityManager.getActivity(userIds[1])).toBe(`game-${gameId}`);
        expect(activityManager.getActivity(userIds[2])).toBe('ranks');
        expect(activityManager.getActivity(userIds[3])).toBe('ranks');
        expect(activityManager.getActivity(userIds[4])).toBe('profile');
        expect(activityManager.getActivity(userIds[5])).toBe('waitingRoom');
      });
      const [
        playerFailOne,
        playerFailTwo,
        profileFail,
        waitingRoomFail,
        ranksSuccessOne,
        ranksSuccessTwo,
      ] = await Promise.allSettled([
        timeout(1000, listenPromise(playerOne, 'ladderUpdate')),
        timeout(1000, listenPromise(playerTwo, 'ladderUpdate')),
        timeout(1000, listenPromise(profile, 'ladderUpdate')),
        timeout(1000, listenPromise(waitingRoom, 'ladderUpdate')),
        listenPromise(ranksOne, 'ladderUpdate'),
        listenPromise(ranksTwo, 'ladderUpdate'),
        gameGateway.abortIfPlayerLeave(gameId, userIds[0]),
      ]);
      expect(playerFailOne.status).toBe('rejected');
      expect(playerFailTwo.status).toBe('rejected');
      expect(profileFail.status).toBe('rejected');
      expect(waitingRoomFail.status).toBe('rejected');
      if (
        ranksSuccessOne.status === 'rejected' ||
        ranksSuccessTwo.status === 'rejected'
      ) {
        fail();
      }
      const [prevWinner, prevLoser] =
        prevGame[0].userId === userIds[1]
          ? [prevGame[0], prevGame[1]]
          : [prevGame[1], prevGame[0]];
      expect(ranksSuccessOne.value).toEqual({
        winnerId: userIds[1],
        ladder:
          prevWinner.ladder +
          calculateLadderRise(prevWinner.ladder, prevLoser.ladder, [0, 5]),
      });
      expect(ranksSuccessTwo.value).toEqual({
        winnerId: userIds[1],
        ladder:
          prevWinner.ladder +
          calculateLadderRise(prevWinner.ladder, prevLoser.ladder, [0, 5]),
      });
    });
  });
});
