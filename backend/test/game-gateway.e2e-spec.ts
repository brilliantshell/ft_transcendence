import { DataSource, In } from 'typeorm';
import { INestApplication } from '@nestjs/common';
import { Socket, io } from 'socket.io-client';
import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { faker } from '@faker-js/faker';
import { nanoid } from 'nanoid';
import waitForExpect from 'wait-for-expect';

import { ActivityManager } from '../src/user-status/activity.manager';
import { AppModule } from '../src/app.module';
import { BannedMembers } from '../src/entity/banned-members.entity';
import { BlockedUsers } from '../src/entity/blocked-users.entity';
import { ChannelMembers } from '../src/entity/channel-members.entity';
import { Channels } from '../src/entity/channels.entity';
import { Friends } from '../src/entity/friends.entity';
import { GameId, GameInfo, UserId } from '../src/util/type';
import { GameGateway } from '../src/game/game.gateway';
import { GameStorage } from '../src/game/game.storage';
import { MatchHistory } from '../src/entity/match-history.entity';
import { Messages } from '../src/entity/messages.entity';
import {
  TYPEORM_SHARED_CONFIG,
  createDataSources,
  destroyDataSources,
} from './db-resource-manager';
import { UserSocketStorage } from '../src/user-status/user-socket.storage';
import { Users } from '../src/entity/users.entity';
import { generateUsers } from './generate-mock-data';
import { timeout } from './util';

const URL = 'http://localhost:4247';

const TEST_DB = 'test_db_game_gateway';
const ENTITIES = [
  BannedMembers,
  BlockedUsers,
  ChannelMembers,
  Channels,
  Friends,
  MatchHistory,
  Messages,
  Users,
];

process.env.NODE_ENV = 'development';

describe('GameGateway (e2e)', () => {
  let app: INestApplication;
  let activityManager: ActivityManager;
  let clientSockets: Socket[];
  let dataSource: DataSource;
  let initDataSource: DataSource;
  let gameStorage: GameStorage;
  let gateway: GameGateway;
  let usersEntities: Users[];
  let users: Users[];
  let userIds: UserId[];
  let userSocketStorage: UserSocketStorage;
  let gameId: GameId;
  let index = 0;

  beforeAll(async () => {
    const dataSources = await createDataSources(TEST_DB, ENTITIES);
    initDataSource = dataSources.initDataSource;
    dataSource = dataSources.dataSource;
    usersEntities = generateUsers(64);
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
    await app.listen(4247);
    gateway = app.get(GameGateway);
    userSocketStorage = app.get(UserSocketStorage);
    activityManager = app.get(ActivityManager);
    gameStorage = app.get(GameStorage);
  });

  beforeEach(async () => {
    users = [usersEntities[index++], usersEntities[index++]];
    userIds = users.map(({ userId }) => userId);
    clientSockets = userIds.map((userId) =>
      io(URL, { extraHeaders: { 'x-user-id': userId.toString() } }),
    );
    await Promise.all(
      clientSockets.map(
        (socket) =>
          new Promise((resolve) => socket.on('connect', () => resolve('done'))),
      ),
    );
    gameId = nanoid();
  });

  afterEach(() => clientSockets.forEach((socket) => socket.disconnect()));

  afterAll(async () => {
    await app.close();
    await destroyDataSources(TEST_DB, dataSource, initDataSource);
  });

  describe('newGame', () => {
    it('should notify both users when a new game is matched (ladder)', async () => {
      const [playerOne, playerTwo] = clientSockets;
      gateway.joinRoom(
        userSocketStorage.clients.get(userIds[0]),
        `game-${gameId}`,
      );
      gateway.joinRoom(
        userSocketStorage.clients.get(userIds[1]),
        `game-${gameId}`,
      );
      const [wsMessageOne, wsMessageTwo] = await Promise.all([
        new Promise((resolve) =>
          playerOne.on('newGame', (data) => resolve(data)),
        ),
        new Promise((resolve) =>
          playerTwo.on('newGame', (data) => resolve(data)),
        ),
        gateway.emitNewGame(`game-${gameId}`, gameId),
      ]);
      expect(wsMessageOne).toEqual({ gameId });
      expect(wsMessageTwo).toEqual({ gameId });
    });

    it('should notify only the invited when a user invites another user to a game (normal)', async () => {
      const [playerOne, playerTwo] = clientSockets;
      gateway.joinRoom(
        userSocketStorage.clients.get(userIds[0]),
        `game-${gameId}`,
      );
      const [wsMessageOne, wsError] = await Promise.allSettled([
        new Promise((resolve) =>
          playerOne.on('newGame', (data) => resolve(data)),
        ),
        timeout(
          1000,
          new Promise((resolve) =>
            playerTwo.on('newGame', (data) => resolve(data)),
          ),
        ),
        gateway.emitNewGame(`game-${gameId}`, gameId),
      ]);
      if (wsMessageOne.status === 'rejected') {
        fail();
      }
      expect(wsMessageOne.value).toEqual({ gameId });
      expect(wsError.status).toEqual('rejected');
    });
  });

  describe('gameStarted', () => {
    beforeEach(async () => {
      users.push(usersEntities[index++], usersEntities[index++]);
      userIds = users.map(({ userId }) => userId);
      clientSockets.push(
        io(URL, { extraHeaders: { 'x-user-id': userIds[2].toString() } }),
        io(URL, { extraHeaders: { 'x-user-id': userIds[3].toString() } }),
      );
      await Promise.all([
        new Promise((resolve) =>
          clientSockets[2].on('connect', () => resolve('done')),
        ),
        new Promise((resolve) =>
          clientSockets[3].on('connect', () => resolve('done')),
        ),
      ]);
    });

    it('should notify all players that are in /waiting-room UI when a new game has been started', async () => {
      const [playerOne, playerTwo, userOne, userTwo] = clientSockets;
      userOne.emit('currentUi', { userId: userIds[2], ui: 'waitingRoom' });
      userTwo.emit('currentUi', { userId: userIds[3], ui: 'waitingRoom' });
      await waitForExpect(() => {
        expect(activityManager.getActivity(userIds[2])).toEqual('waitingRoom');
        expect(activityManager.getActivity(userIds[3])).toEqual('waitingRoom');
      });
      gateway.joinRoom(
        userSocketStorage.clients.get(userIds[0]),
        `game-${gameId}`,
      );
      gateway.joinRoom(
        userSocketStorage.clients.get(userIds[1]),
        `game-${gameId}`,
      );
      const [
        newGameOne,
        newGameTwo,
        newGameFailOne,
        newGameFailTwo,
        gameStartedFailOne,
        gameStartedFailTwo,
        gameStartedOne,
        gameStartedTwo,
      ] = await Promise.allSettled([
        new Promise((res) => playerOne.on('newGame', (data) => res(data))),
        new Promise((res) => playerTwo.on('newGame', (data) => res(data))),
        timeout(
          1000,
          new Promise((res) => userOne.on('newGame', (data) => res(data))),
        ),
        timeout(
          1000,
          new Promise((res) => userTwo.on('newGame', (data) => res(data))),
        ),
        timeout(
          1000,
          new Promise((res) =>
            playerOne.on('gameStarted', (data) => res(data)),
          ),
        ),
        timeout(
          1000,
          new Promise((res) =>
            playerTwo.on('gameStarted', (data) => res(data)),
          ),
        ),
        new Promise((res) => userOne.on('gameStarted', (data) => res(data))),
        new Promise((res) => userTwo.on('gameStarted', (data) => res(data))),
        gateway.emitNewGame(`game-${gameId}`, gameId),
        gateway.emitGameStarted('waitingRoom', {
          id: gameId,
          left: users[0].nickname,
          right: users[1].nickname,
        }),
      ]);
      expect(newGameFailOne.status).toEqual('rejected');
      expect(newGameFailTwo.status).toEqual('rejected');
      expect(gameStartedFailOne.status).toEqual('rejected');
      expect(gameStartedFailTwo.status).toEqual('rejected');
      expect(newGameOne.status).toEqual('fulfilled');
      expect(newGameTwo.status).toEqual('fulfilled');
      if (
        gameStartedOne.status === 'rejected' ||
        gameStartedTwo.status === 'rejected'
      ) {
        fail();
      }
      expect(gameStartedOne.value).toEqual(gameStartedTwo.value);
      expect(gameStartedOne.value).toEqual({
        id: gameId,
        left: users[0].nickname,
        right: users[1].nickname,
      });
    });

    it('should notify only to the players that are in /waiting-room UI when a new game has been started', async () => {
      const [playerOne, playerTwo, userOne, userTwo] = clientSockets;
      userOne.emit('currentUi', { userId: userIds[2], ui: 'profile' });
      userTwo.emit('currentUi', { userId: userIds[3], ui: 'waitingRoom' });
      await waitForExpect(() => {
        expect(activityManager.getActivity(userIds[2])).toEqual('profile');
        expect(activityManager.getActivity(userIds[3])).toEqual('waitingRoom');
      });
      gateway.joinRoom(
        userSocketStorage.clients.get(userIds[0]),
        `game-${gameId}`,
      );
      gateway.joinRoom(
        userSocketStorage.clients.get(userIds[1]),
        `game-${gameId}`,
      );
      const [
        newGameOne,
        newGameTwo,
        newGameFailOne,
        newGameFailTwo,
        gameStartedFailOne,
        gameStartedFailTwo,
        gameStartedFailThree,
        gameStartedOne,
      ] = await Promise.allSettled([
        new Promise((res) => playerOne.on('newGame', (data) => res(data))),
        new Promise((res) => playerTwo.on('newGame', (data) => res(data))),
        timeout(
          1000,
          new Promise((res) => userOne.on('newGame', (data) => res(data))),
        ),
        timeout(
          1000,
          new Promise((res) => userTwo.on('newGame', (data) => res(data))),
        ),
        timeout(
          1000,
          new Promise((res) =>
            playerOne.on('gameStarted', (data) => res(data)),
          ),
        ),
        timeout(
          1000,
          new Promise((res) =>
            playerTwo.on('gameStarted', (data) => res(data)),
          ),
        ),
        timeout(
          1000,
          new Promise((res) => userOne.on('gameStarted', (data) => res(data))),
        ),
        new Promise((res) => userTwo.on('gameStarted', (data) => res(data))),
        gateway.emitNewGame(`game-${gameId}`, gameId),
        gateway.emitGameStarted('waitingRoom', {
          id: gameId,
          left: users[0].nickname,
          right: users[1].nickname,
        }),
      ]);
      expect(newGameFailOne.status).toEqual('rejected');
      expect(newGameFailTwo.status).toEqual('rejected');
      expect(gameStartedFailOne.status).toEqual('rejected');
      expect(gameStartedFailTwo.status).toEqual('rejected');
      expect(gameStartedFailThree.status).toEqual('rejected');
      expect(newGameOne.status).toEqual('fulfilled');
      expect(newGameTwo.status).toEqual('fulfilled');
      if (gameStartedOne.status === 'rejected') {
        fail();
      }
      expect(gameStartedOne.value).toEqual({
        id: gameId,
        left: users[0].nickname,
        right: users[1].nickname,
      });
    });
  });

  describe('gameOption', () => {
    it('should notify the invited that the game option has been changed', async () => {
      const [playerOne] = clientSockets;
      gateway.joinRoom(
        userSocketStorage.clients.get(userIds[0]),
        `game-${gameId}`,
      );
      const [wsMessageOne] = await Promise.all([
        new Promise((resolve) =>
          playerOne.on('gameOption', (data) => resolve(data)),
        ),
        gateway.emitGameOption(`game-${gameId}`, 3),
      ]);
      expect(wsMessageOne).toEqual({ map: 3 });
    });
  });

  describe('gameComplete', () => {
    it('should throw error when the client sends invalid message', async () => {
      const [playerOne] = clientSockets;
      gateway.joinRoom(
        userSocketStorage.clients.get(userIds[0]),
        `game-${gameId}`,
      );
      gateway.joinRoom(
        userSocketStorage.clients.get(userIds[1]),
        `game-${gameId}`,
      );
      gameStorage.games.set(gameId, new GameInfo(users[0], users[1], 1, true));
      playerOne.emit('gameComplete', { id: gameId }); // no scores
      await new Promise((resolve) => setTimeout(resolve, 300));
      expect(gameStorage.games.get(gameId)).toBeDefined();
      expect(gateway.doesRoomExist(`game-${gameId}`)).toBeTruthy();
      playerOne.emit('gameComplete', { id: '0123456789abcdefghij' }); // invalid gameId (20 bytes)
      await new Promise((resolve) => setTimeout(resolve, 300));
      expect(gameStorage.games.get(gameId)).toBeDefined();
      expect(gateway.doesRoomExist(`game-${gameId}`)).toBeTruthy();
      playerOne.emit('gameComplete', { id: gameId, scores: [0, 'a'] }); // invalid scores
      await new Promise((resolve) => setTimeout(resolve, 300));
      expect(gameStorage.games.get(gameId)).toBeDefined();
      expect(gateway.doesRoomExist(`game-${gameId}`)).toBeTruthy();
      playerOne.emit('gameComplete', { id: gameId, scores: [0, 6] }); // invalid scores out of range
      await new Promise((resolve) => setTimeout(resolve, 300));
      expect(gameStorage.games.get(gameId)).toBeDefined();
      expect(gateway.doesRoomExist(`game-${gameId}`)).toBeTruthy();
      playerOne.emit('gameComplete', { id: gameId, scores: [0, 6], hi: 'hi' }); // non existing property
      await new Promise((resolve) => setTimeout(resolve, 300));
      expect(gameStorage.games.get(gameId)).toBeDefined();
      expect(gateway.doesRoomExist(`game-${gameId}`)).toBeTruthy();
    });

    it('should destroy room and update match result when a game ends (left wins, ladder)', async () => {
      const playerOne = clientSockets[0];
      const prevGame = await dataSource.manager.find(Users, {
        select: ['userId', 'winCount', 'lossCount', 'ladder'],
        where: { userId: In(userIds) },
      });
      expect(prevGame.length).toBe(2);
      gateway.joinRoom(
        userSocketStorage.clients.get(userIds[0]),
        `game-${gameId}`,
      );
      gateway.joinRoom(
        userSocketStorage.clients.get(userIds[1]),
        `game-${gameId}`,
      );
      gameStorage.games.set(gameId, new GameInfo(users[0], users[1], 1, true));
      const scores = [5, faker.datatype.number({ min: 0, max: 4 })];
      playerOne.emit('gameComplete', {
        id: gameId,
        scores,
      });
      await waitForExpect(async () => {
        expect(gameStorage.games.get(gameId)).toBeUndefined();
        expect(gateway.doesRoomExist(`game-${gameId}`)).toBeFalsy();
      });
      expect(
        await dataSource.manager.countBy(MatchHistory, {
          userOneId: userIds[0],
          userTwoId: userIds[1],
        }),
      ).toEqual(1);
      const postGame = await dataSource.manager.find(Users, {
        select: ['userId', 'winCount', 'lossCount', 'ladder'],
        where: { userId: In(userIds) },
      });
      const { prevWinner, prevLoser, postWinner, postLoser } = winnerLoserStats(
        prevGame,
        postGame,
        userIds[0],
      );
      const ladderRise = calculateLadderRise(
        prevWinner.ladder,
        prevLoser.ladder,
        scores,
        prevWinner.ladder >= prevLoser.ladder,
      );
      expect(postGame.length).toBe(2);
      expect(postWinner).toMatchObject({
        winCount: prevWinner.winCount + 1,
        lossCount: prevWinner.lossCount,
        ladder: prevWinner.ladder + ladderRise,
      });
      expect(postLoser).toMatchObject({
        winCount: prevLoser.winCount,
        lossCount: prevLoser.lossCount + 1,
        ladder: prevLoser.ladder,
      });
    });

    it('should destroy room and update match result when a game ends (right wins, ladder)', async () => {
      const playerTwo = clientSockets[1];
      const prevGame = await dataSource.manager.find(Users, {
        select: ['userId', 'winCount', 'lossCount', 'ladder'],
        where: { userId: In(userIds) },
      });
      expect(prevGame.length).toBe(2);
      gateway.joinRoom(
        userSocketStorage.clients.get(userIds[0]),
        `game-${gameId}`,
      );
      gateway.joinRoom(
        userSocketStorage.clients.get(userIds[1]),
        `game-${gameId}`,
      );
      gameStorage.games.set(gameId, new GameInfo(users[0], users[1], 1, true));
      const scores = [faker.datatype.number({ min: 0, max: 4 }), 5];
      playerTwo.emit('gameComplete', {
        id: gameId,
        scores,
      });
      await waitForExpect(async () => {
        expect(gameStorage.games.get(gameId)).toBeUndefined();
        expect(gateway.doesRoomExist(`game-${gameId}`)).toBeFalsy();
      });
      expect(
        await dataSource.manager.countBy(MatchHistory, {
          userOneId: userIds[0],
          userTwoId: userIds[1],
        }),
      ).toEqual(1);
      const postGame = await dataSource.manager.find(Users, {
        select: ['userId', 'winCount', 'lossCount', 'ladder'],
        where: { userId: In(userIds) },
      });
      const { prevWinner, prevLoser, postWinner, postLoser } = winnerLoserStats(
        prevGame,
        postGame,
        userIds[1],
      );
      const ladderRise = calculateLadderRise(
        prevWinner.ladder,
        prevLoser.ladder,
        scores,
        prevWinner.ladder >= prevLoser.ladder,
      );
      expect(postGame.length).toBe(2);
      expect(postWinner).toMatchObject({
        winCount: prevWinner.winCount + 1,
        lossCount: prevWinner.lossCount,
        ladder: prevWinner.ladder + ladderRise,
      });
      expect(postLoser).toMatchObject({
        winCount: prevLoser.winCount,
        lossCount: prevLoser.lossCount + 1,
        ladder: prevLoser.ladder,
      });
    });

    it('should not update ladder when the normal game ends', async () => {
      const playerOne = clientSockets[0];
      const prevGame = await dataSource.manager.find(Users, {
        select: ['userId', 'winCount', 'lossCount', 'ladder'],
        where: { userId: In(userIds) },
      });
      expect(prevGame.length).toBe(2);
      gateway.joinRoom(
        userSocketStorage.clients.get(userIds[0]),
        `game-${gameId}`,
      );
      gateway.joinRoom(
        userSocketStorage.clients.get(userIds[1]),
        `game-${gameId}`,
      );
      gameStorage.games.set(gameId, new GameInfo(users[0], users[1], 1, false));
      const scores = [5, faker.datatype.number({ min: 0, max: 4 })];
      playerOne.emit('gameComplete', {
        id: gameId,
        scores,
      });
      await waitForExpect(async () => {
        expect(gameStorage.games.get(gameId)).toBeUndefined();
        expect(gateway.doesRoomExist(`game-${gameId}`)).toBeFalsy();
      });
      expect(
        await dataSource.manager.countBy(MatchHistory, {
          userOneId: userIds[0],
          userTwoId: userIds[1],
        }),
      ).toEqual(1);
      const postGame = await dataSource.manager.find(Users, {
        select: ['userId', 'winCount', 'lossCount', 'ladder'],
        where: { userId: In(userIds) },
      });
      const { prevWinner, prevLoser, postWinner, postLoser } = winnerLoserStats(
        prevGame,
        postGame,
        userIds[0],
      );
      expect(postGame.length).toBe(2);
      expect(postWinner).toMatchObject({
        winCount: prevWinner.winCount + 1,
        lossCount: prevWinner.lossCount,
        ladder: prevWinner.ladder,
      });
      expect(postLoser).toMatchObject({
        winCount: prevLoser.winCount,
        lossCount: prevLoser.lossCount + 1,
        ladder: prevLoser.ladder,
      });
    });

    /*****************************************************************************
     *                                                                           *
     * SECTION : Utils                                                           *
     *                                                                           *
     ****************************************************************************/

    const calculateLadderRise = (
      winnerLadder: number,
      loserLadder: number,
      scores: number[],
      isHigher: boolean,
    ) => {
      const ladderGap = Math.abs(winnerLadder - loserLadder);
      const scoreGap = Math.abs(scores[0] - scores[1]);
      return isHigher
        ? Math.max(Math.floor(scoreGap * (1 - ladderGap / 42)), 1)
        : Math.floor(scoreGap * (1 + ladderGap / 42));
    };

    const winnerLoserStats = (
      prevGame: Users[],
      postGame: Users[],
      winnerId: UserId,
    ) => {
      const [prevWinner, prevLoser] =
        prevGame[0].userId === winnerId
          ? [prevGame[0], prevGame[1]]
          : [prevGame[1], prevGame[0]];
      const [postWinner, postLoser] =
        postGame[0].userId === winnerId
          ? [postGame[0], postGame[1]]
          : [postGame[1], postGame[0]];
      return { prevWinner, prevLoser, postWinner, postLoser };
    };
  });
});

// TODO : 추후에 클라이언트에서 라이브로 전달되어야하는 데이터가 파악되면 구현
// describe('gameStatus', () => {
//   it('should notify both players of the games current status', async () => {
//     const [playerOne, playerTwo] = clientSockets;
//     const gameId = nanoid();
//     gateway.joinRoom(
//       userSocketStorage.clients.get(userIds[0]),
//       `game-${gameId}`,
//     );
//     gateway.joinRoom(
//       userSocketStorage.clients.get(userIds[1]),
//       `game-${gameId}`,
//     );
//     const [wsMessageOne, wsMessageTwo] = await Promise.all([
//       new Promise((resolve) =>
//         playerOne.on('gameStatus', (data) => resolve(data)),
//       ),
//       new Promise((resolve) =>
//         playerTwo.on('gameStatus', (data) => resolve(data)),
//       ),
//       gateway.emitGameStatus(`game-${gameId}`, 'started'),
//     ]);
//     expect(wsMessageOne).toEqual({ status: 'started' });
//     expect(wsMessageTwo).toEqual({ status: 'started' });
//   });
// });
