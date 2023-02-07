import { INestApplication } from '@nestjs/common';
import { Socket, io } from 'socket.io-client';
import { Test, TestingModule } from '@nestjs/testing';

import { AppModule } from '../src/app.module';
import { GameGateway } from '../src/game/game.gateway';
import { UserId } from '../src/util/type';
import { UserSocketStorage } from '../src/user-status/user-socket.storage';
import { Users } from '../src/entity/users.entity';
import { generateUsers } from './generate-mock-data';
import { nanoid } from 'nanoid';
import { timeout } from './util';

const URL = 'http://localhost:4247';

describe('GameGateway (e2e)', () => {
  let app: INestApplication;
  let clientSockets: Socket[];
  let gateway: GameGateway;
  let usersEntities: Users[];
  let userIds: UserId[];
  let userSocketStorage: UserSocketStorage;
  let index = 0;

  beforeAll(async () => {
    usersEntities = generateUsers(30);
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    await app.init();
    await app.listen(4247);
    gateway = app.get(GameGateway);
    userSocketStorage = app.get(UserSocketStorage);
  });

  beforeEach(async () => {
    userIds = [
      usersEntities[index++].userId,
      usersEntities[index++].userId,
      usersEntities[index++].userId,
    ];
    clientSockets = userIds.map((userId) =>
      io(URL, { extraHeaders: { 'x-user-id': userId.toString() } }),
    );
    await Promise.all(
      clientSockets.map(
        (socket) =>
          new Promise((resolve) => socket.on('connect', () => resolve('done'))),
      ),
    );
  });

  afterEach(() => {
    clientSockets.forEach((socket) => socket.disconnect());
  });

  afterAll(async () => await app.close());

  describe('newGame', () => {
    it('should notify both users when a new game is matched (ladder)', async () => {
      const [playerOne, playerTwo] = clientSockets;
      const gameId = nanoid();
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
      const gameId = nanoid();
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

  // describe('gameStarted', () => {
  //   it('should notify all players that are at /waiting-room UI that a new game has been started', async () => {});
  // });

  describe('gameOption', () => {
    it('should notify the invited that the game option has been changed', async () => {
      const [playerOne] = clientSockets;
      const gameId = nanoid();
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
});
