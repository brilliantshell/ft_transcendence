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
} from './util/db-resource-manager';
import { UserSocketStorage } from '../src/user-status/user-socket.storage';
import { Users } from '../src/entity/users.entity';
import { calculateLadderRise, listenPromise, timeout } from './util/util';
import { generateUsers } from './util/generate-mock-data';

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
process.env.DB_HOST = 'localhost';

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
      clientSockets.map((socket) => listenPromise(socket, 'connect')),
    );
    gameId = nanoid();
  });

  afterEach(() => clientSockets.forEach((socket) => socket.disconnect()));

  afterAll(async () => {
    await new Promise((resolve) => setTimeout(resolve, 300));
    await app.close();
    await destroyDataSources(TEST_DB, dataSource, initDataSource);
  });

  /*****************************************************************************
   *                                                                           *
   * SECTION : Join & leave rooms                                              *
   *                                                                           *
   ****************************************************************************/
  /**
   * UI 변경시 방 관리
   */

  describe('join & leave rooms', () => {
    beforeEach(async () => {
      users.push(usersEntities[index++]);
      userIds.push(users[2].userId);
      clientSockets.push(
        io(URL, { extraHeaders: { 'x-user-id': userIds[2].toString() } }),
      );
      await listenPromise(clientSockets[2], 'connect');
      gameStorage.createGame(
        gameId,
        new GameInfo(userIds[0], userIds[1], 1, true),
      );
    });

    it('should join and leave rooms', async () => {
      const [playerOne, playerTwo, user] = clientSockets;
      playerOne.emit('currentUi', { ui: 'waitingRoom' });
      playerTwo.emit('currentUi', { ui: `game-${gameId}` });
      user.emit('currentUi', { ui: `game-${gameId}` });
      await waitForExpect(() => {
        expect(activityManager.getActivity(userIds[0])).toEqual('waitingRoom');
        expect(activityManager.getActivity(userIds[1])).toEqual(
          `game-${gameId}`,
        );
        expect(activityManager.getActivity(userIds[2])).toEqual(
          `game-${gameId}`,
        );
        expect(gateway.doesRoomExist('waitingRoom')).toBeTruthy();
        expect(gateway.doesRoomExist(`game-${gameId}`)).toBeTruthy();
      });
      playerOne.emit('currentUi', { ui: 'profile' });
      playerTwo.emit('currentUi', { ui: 'ranks' });
      user.emit('currentUi', { ui: `chats` });
      await waitForExpect(() => {
        expect(activityManager.getActivity(userIds[0])).toEqual('profile');
        expect(activityManager.getActivity(userIds[1])).toEqual('ranks');
        expect(activityManager.getActivity(userIds[2])).toEqual('chats');
        expect(gateway.doesRoomExist('waitingRoom')).toBeFalsy();
        expect(gateway.doesRoomExist(`game-${gameId}`)).toBeFalsy();
      });
    });
  });

  /*****************************************************************************
   *                                                                           *
   * SECTION : newGame & newNormalGame emitter                                 *
   *                                                                           *
   ****************************************************************************/
  /**
   * 게임이 매칭되었을 때, 초대 시 초대 받은 유저에게 newNormalGame 을
   * 래더 시 두 유저에게 newGame 이벤트를 보낸다
   */

  describe('newGame & newNormalGame', () => {
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
        listenPromise(playerOne, 'newGame'),
        listenPromise(playerTwo, 'newGame'),
        gateway.emitNewGame(gameId),
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
        listenPromise(playerOne, 'newNormalGame'),
        timeout(1000, listenPromise(playerTwo, 'newNormalGame')),
        gateway.emitNewNormalGame(gameId, users[0].nickname),
      ]);
      if (wsMessageOne.status === 'rejected') {
        fail();
      }
      expect(wsMessageOne.value).toEqual({
        gameId,
        inviterNickname: users[0].nickname,
      });
      expect(wsError.status).toEqual('rejected');
    });
  });

  /*****************************************************************************
   *                                                                           *
   * SECTION : gameStarted Emitter                                             *
   *                                                                           *
   ****************************************************************************/
  /**
   * 게임이 취소됐을 때, 플레이어들과 관전자들에게 알림을 보낸다
   */

  describe('gameCancelled', () => {
    beforeEach(async () => {
      users.push(usersEntities[index++]);
      userIds.push(users[2].userId);
      clientSockets.push(
        io(URL, { extraHeaders: { 'x-user-id': userIds[2].toString() } }),
      );
      await listenPromise(clientSockets[2], 'connect');
    });

    it('should notify all players and spectators that the game is cancelled', async () => {
      const [playerOne, playerTwo, spectator] = clientSockets;
      gateway.joinRoom(
        userSocketStorage.clients.get(userIds[0]),
        `game-${gameId}`,
      );
      gateway.joinRoom(
        userSocketStorage.clients.get(userIds[1]),
        `game-${gameId}`,
      );
      gateway.joinRoom(
        userSocketStorage.clients.get(userIds[2]),
        `game-${gameId}`,
      );
      const results = await Promise.allSettled([
        listenPromise(playerOne, 'gameCancelled'),
        listenPromise(playerTwo, 'gameCancelled'),
        listenPromise(spectator, 'gameCancelled'),
        gateway.emitGameCancelled(gameId),
      ]);
      results.forEach(({ status }) => expect(status).toEqual('fulfilled'));
    });
  });

  /*****************************************************************************
   *                                                                           *
   * SECTION : gameStarted Emitter                                             *
   *                                                                           *
   ****************************************************************************/
  /**
   * 게임이 시작되었을 때, waiting-room UI에 있는 유저들에게 알림을 보낸다
   */

  describe('gameStarted', () => {
    beforeEach(async () => {
      users.push(usersEntities[index++], usersEntities[index++]);
      userIds = users.map(({ userId }) => userId);
      clientSockets.push(
        io(URL, { extraHeaders: { 'x-user-id': userIds[2].toString() } }),
        io(URL, { extraHeaders: { 'x-user-id': userIds[3].toString() } }),
      );
      await Promise.all([
        listenPromise(clientSockets[2], 'connect'),
        listenPromise(clientSockets[3], 'connect'),
      ]);
    });

    it('should notify all players that are in /waiting-room UI when a new game has been started', async () => {
      const [playerOne, playerTwo, userOne, userTwo] = clientSockets;
      userOne.emit('currentUi', { ui: 'waitingRoom' });
      userTwo.emit('currentUi', { ui: 'waitingRoom' });
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
        listenPromise(playerOne, 'newGame'),
        listenPromise(playerTwo, 'newGame'),
        timeout(1000, listenPromise(userOne, 'newGame')),
        timeout(1000, listenPromise(userTwo, 'newGame')),
        timeout(1000, listenPromise(playerOne, 'gameStarted')),
        timeout(1000, listenPromise(playerTwo, 'gameStarted')),
        listenPromise(userOne, 'gameStarted'),
        listenPromise(userTwo, 'gameStarted'),
        gateway.emitNewGame(gameId),
        gateway.emitGameStarted({
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
      userOne.emit('currentUi', { ui: 'profile' });
      userTwo.emit('currentUi', { ui: 'waitingRoom' });
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
        listenPromise(playerOne, 'newGame'),
        listenPromise(playerTwo, 'newGame'),
        timeout(1000, listenPromise(userOne, 'newGame')),
        timeout(1000, listenPromise(userTwo, 'newGame')),
        timeout(1000, listenPromise(playerOne, 'gameStarted')),
        timeout(1000, listenPromise(playerTwo, 'gameStarted')),
        timeout(1000, listenPromise(userOne, 'gameStarted')),
        listenPromise(userTwo, 'gameStarted'),
        gateway.emitNewGame(gameId),
        gateway.emitGameStarted({
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

  /*****************************************************************************
   *                                                                           *
   * SECTION : gameOption emitter                                              *
   *                                                                           *
   ****************************************************************************/
  /**
   * 게임 옵션이 설정되었을 때, 게임에 참여한 유저에게 알린다
   */

  describe('gameOption', () => {
    beforeEach(async () => {
      users.push(usersEntities[index++]);
      userIds.push(users[2].userId);
      clientSockets.push(
        io(URL, { extraHeaders: { 'x-user-id': userIds[2].toString() } }),
      );
      await listenPromise(clientSockets[2], 'connect');
    });

    it('should notify the invited that the game option has been changed', async () => {
      const [playerOne, playerTwo, spectator] = clientSockets;
      gateway.joinRoom(
        userSocketStorage.clients.get(userIds[0]),
        `game-${gameId}`,
      );
      gateway.joinRoom(
        userSocketStorage.clients.get(userIds[1]),
        `game-${gameId}`,
      );
      gateway.joinRoom(
        userSocketStorage.clients.get(userIds[2]),
        `game-${gameId}`,
      );
      const [wsMessageOne, wsMessageTwo, wsError] = await Promise.allSettled([
        listenPromise(playerOne, 'gameOption'),
        listenPromise(spectator, 'gameOption'),
        timeout(1000, listenPromise(playerTwo, 'gameOption')),
        gateway.emitGameOption(
          gameId,
          userSocketStorage.clients.get(userIds[1]),
          2,
        ),
      ]);
      expect(wsError.status).toEqual('rejected');
      if (
        wsMessageOne.status === 'rejected' ||
        wsMessageTwo.status === 'rejected'
      ) {
        fail();
      }
      expect(wsMessageOne.value).toEqual({ mode: 2 });
      expect(wsMessageTwo.value).toEqual({ mode: 2 });
    });
  });

  /*****************************************************************************
   *                                                                           *
   * SECTION : gameAborted Emiiter                                             *
   *                                                                           *
   ****************************************************************************/
  /**
   * 플레이어가 게임 UI 를 떠나거나, disconnect 되는 경우 게임이 취소되고, 떠난 플레이어가 패배 처리
   * 나머지 플레이어 & 관전자들에게 게임이 폭파되었다는 메시지를 보냄
   */

  describe('gameAborted', () => {
    let playerOne: Socket;
    let playerTwo: Socket;
    let spectator: Socket;
    let prevGame: Users[];

    beforeEach(async () => {
      users.push(usersEntities[index++]);
      userIds.push(users[2].userId);
      clientSockets.push(
        io(URL, { extraHeaders: { 'x-user-id': userIds[2].toString() } }),
      );
      await listenPromise(clientSockets[2], 'connect');
      clientSockets.forEach((socket) =>
        socket.emit('currentUi', { ui: `game-${gameId}` }),
      );
      await waitForExpect(() => {
        expect(activityManager.getActivity(userIds[0])).toEqual(
          `game-${gameId}`,
        );
        expect(activityManager.getActivity(userIds[1])).toEqual(
          `game-${gameId}`,
        );
        expect(activityManager.getActivity(userIds[2])).toEqual(
          `game-${gameId}`,
        );
      });
      await gameStorage.createGame(
        gameId,
        new GameInfo(userIds[0], userIds[1], 1, true),
      );
      playerOne = clientSockets[0];
      playerTwo = clientSockets[1];
      spectator = clientSockets[2];
      prevGame = await dataSource.manager.find(Users, {
        select: ['userId', 'winCount', 'lossCount', 'ladder'],
        where: { userId: In([userIds[0], userIds[1]]) },
      });
    });

    it('should do nothing when the spectator is disconnected', async () => {
      expect(prevGame.length).toBe(2);
      const [wsErrorOne, wsErrorTwo] = await Promise.allSettled([
        timeout(1000, listenPromise(playerOne, 'gameAborted')),
        timeout(1000, listenPromise(playerTwo, 'gameAborted')),
        spectator.disconnect(),
      ]);
      expect(wsErrorOne.status).toBe('rejected');
      expect(wsErrorTwo.status).toBe('rejected');
      expect(gameStorage.getGame(gameId)).toBeDefined();
      expect(gateway.doesRoomExist(`game-${gameId}`)).toBeTruthy();
      expect(
        await dataSource.manager.exists(MatchHistory, {
          where: { userOneId: userIds[0], userTwoId: userIds[1] },
        }),
      ).toBeFalsy();
      const postGame = await dataSource.manager.find(Users, {
        select: ['userId', 'winCount', 'lossCount', 'ladder'],
        where: { userId: In([userIds[0], userIds[1]]) },
      });
      expect(postGame).toEqual(prevGame);
    });

    it('should destroy room, update the result, notify the other player and the spectator (a player left game UI)', async () => {
      expect(prevGame.length).toBe(2);
      const [wsOne, wsTwo] = await Promise.all([
        listenPromise(playerTwo, 'gameAborted'),
        listenPromise(spectator, 'gameAborted'),
        playerOne.emit('currentUi', { ui: 'waitingRoom' }),
      ]);
      expect(wsOne).toEqual({ abortedSide: 'left' });
      expect(wsTwo).toEqual({ abortedSide: 'left' });
      expect(gateway.doesRoomExist(`game-${gameId}`)).toBeFalsy();
      const { userOneScore, userTwoScore } = await dataSource.manager.findOneBy(
        MatchHistory,
        {
          userOneId: userIds[0],
          userTwoId: userIds[1],
        },
      );
      expect(userOneScore).toEqual(0);
      expect(userTwoScore).toEqual(5);
      const postGame = await dataSource.manager.find(Users, {
        select: ['userId', 'winCount', 'lossCount', 'ladder'],
        where: { userId: In([userIds[0], userIds[1]]) },
      });
      expect(postGame.length).toBe(2);
      const { prevWinner, prevLoser, postWinner, postLoser } = winnerLoserStats(
        prevGame,
        postGame,
        userIds[1],
      );
      const ladderRise = calculateLadderRise(
        prevWinner.ladder,
        prevLoser.ladder,
        [0, 5],
      );
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
      expect(gameStorage.getGame(gameId)).toBeUndefined();
      expect(gateway.doesRoomExist(`game-${gameId}`)).toBeFalsy();
    });

    it('should do nothing when the spectator left the game UI', async () => {
      expect(prevGame.length).toBe(2);
      const [wsErrorOne, wsErrorTwo] = await Promise.allSettled([
        timeout(1000, listenPromise(playerOne, 'gameAborted')),
        timeout(1000, listenPromise(playerTwo, 'gameAborted')),
        spectator.emit('currentUi', { ui: 'waitingRoom' }),
      ]);
      expect(wsErrorOne.status).toBe('rejected');
      expect(wsErrorTwo.status).toBe('rejected');
      expect(gameStorage.getGame(gameId)).toBeDefined();
      expect(gateway.doesRoomExist(`game-${gameId}`)).toBeTruthy();
      expect(
        await dataSource.manager.exists(MatchHistory, {
          where: { userOneId: userIds[0], userTwoId: userIds[1] },
        }),
      ).toBeFalsy();
      const postGame = await dataSource.manager.find(Users, {
        select: ['userId', 'winCount', 'lossCount', 'ladder'],
        where: { userId: In([userIds[0], userIds[1]]) },
      });
      expect(postGame).toEqual(prevGame);
    });
  });

  /*****************************************************************************
   *                                                                           *
   * SECTION : gameEnded Emiiter                                               *
   *                                                                           *
   ****************************************************************************/
  /**
   * 게임이 종료되면 waitingRoom UI 에 있는 유저들에게 알림
   */

  describe('gameEnded', () => {
    beforeEach(async () => {
      users.push(usersEntities[index++], usersEntities[index++]);
      userIds = users.map(({ userId }) => userId);
      clientSockets.push(
        io(URL, { extraHeaders: { 'x-user-id': userIds[2].toString() } }),
        io(URL, { extraHeaders: { 'x-user-id': userIds[3].toString() } }),
      );
      await Promise.all([
        listenPromise(clientSockets[2], 'connect'),
        listenPromise(clientSockets[3], 'connect'),
      ]);
    });

    it('should notify the users in waiting-room when the ladder game is ended', async () => {
      const [playerOne, playerTwo, waitingOne, waitingTwo] = clientSockets;
      await gameStorage.createGame(
        gameId,
        new GameInfo(userIds[0], userIds[1], 1, true),
      );
      playerOne.emit('currentUi', { ui: `game-${gameId}` });
      playerTwo.emit('currentUi', { ui: `game-${gameId}` });
      waitingOne.emit('currentUi', { ui: 'waitingRoom' });
      waitingTwo.emit('currentUi', { ui: 'waitingRoom' });
      await waitForExpect(() => {
        expect(gateway.doesRoomExist(`game-${gameId}`)).toBeTruthy();
        expect(gateway.doesRoomExist('waitingRoom')).toBeTruthy();
        expect(gameStorage.getGame(gameId)).toBeDefined();
        expect(activityManager.getActivity(userIds[0])).toEqual(
          `game-${gameId}`,
        );
        expect(activityManager.getActivity(userIds[1])).toEqual(
          `game-${gameId}`,
        );
        expect(activityManager.getActivity(userIds[2])).toEqual('waitingRoom');
        expect(activityManager.getActivity(userIds[3])).toEqual('waitingRoom');
      });
      const [wsErrorOne, wsErrorTwo, wsOne, wsTwo] = await Promise.allSettled([
        timeout(1000, listenPromise(playerOne, 'gameEnded')),
        timeout(1000, listenPromise(playerTwo, 'gameEnded')),
        listenPromise(waitingOne, 'gameEnded'),
        listenPromise(waitingTwo, 'gameEnded'),
        gateway.abortIfPlayerLeave(gameId, userIds[0]), // 테스트 위해 게임 강제 종료
      ]);
      expect(gameStorage.getGame(gameId)).toBeUndefined();
      expect(gateway.doesRoomExist(`game-${gameId}`)).toBeFalsy();
      expect(wsErrorOne.status).toEqual('rejected');
      expect(wsErrorTwo.status).toEqual('rejected');
      if (wsOne.status !== 'fulfilled' || wsTwo.status !== 'fulfilled') {
        fail();
      }
      expect(wsOne.value).toEqual({ id: gameId });
      expect(wsTwo.value).toEqual({ id: gameId });
    });

    it('should not notify the users in waiting-room when the non-ladder game is ended', async () => {
      const [playerOne, playerTwo, waitingOne, waitingTwo] = clientSockets;
      await gameStorage.createGame(
        gameId,
        new GameInfo(userIds[0], userIds[1], 1, false),
      );
      playerOne.emit('currentUi', { ui: `game-${gameId}` });
      playerTwo.emit('currentUi', { ui: `game-${gameId}` });
      waitingOne.emit('currentUi', { ui: 'waitingRoom' });
      waitingTwo.emit('currentUi', { ui: 'waitingRoom' });
      await waitForExpect(() => {
        expect(gateway.doesRoomExist(`game-${gameId}`)).toBeTruthy();
        expect(gateway.doesRoomExist('waitingRoom')).toBeTruthy();
        expect(gameStorage.getGame(gameId)).toBeDefined();
        expect(activityManager.getActivity(userIds[0])).toEqual(
          `game-${gameId}`,
        );
        expect(activityManager.getActivity(userIds[1])).toEqual(
          `game-${gameId}`,
        );
        expect(activityManager.getActivity(userIds[2])).toEqual('waitingRoom');
        expect(activityManager.getActivity(userIds[3])).toEqual('waitingRoom');
      });
      const [wsErrorOne, wsErrorTwo, wsOne, wsTwo] = await Promise.allSettled([
        timeout(1000, listenPromise(playerOne, 'gameEnded')),
        timeout(1000, listenPromise(playerTwo, 'gameEnded')),
        timeout(1000, listenPromise(waitingOne, 'gameEnded')),
        timeout(1000, listenPromise(waitingTwo, 'gameEnded')),
        gateway.abortIfPlayerLeave(gameId, userIds[0]), // 테스트 위해 게임 강제 종료
      ]);
      expect(wsOne.status).toEqual('rejected');
      expect(wsTwo.status).toEqual('rejected');
      expect(wsErrorOne.status).toEqual('rejected');
      expect(wsErrorTwo.status).toEqual('rejected');
    });
  });

  /*****************************************************************************
   *                                                                           *
   * SECTION : Utils                                                           *
   *                                                                           *
   ****************************************************************************/

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
