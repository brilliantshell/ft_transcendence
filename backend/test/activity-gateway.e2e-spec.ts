import { INestApplication } from '@nestjs/common';
import { Socket, io } from 'socket.io-client';
import { Test, TestingModule } from '@nestjs/testing';
import { nanoid } from 'nanoid';
import waitForExpect from 'wait-for-expect';

import { ActivityManager } from '../src/user-status/activity.manager';
import { AppModule } from '../src/app.module';
import { UserSocketStorage } from '../src/user-status/user-socket.storage';
import { UserStatusModule } from '../src/user-status/user-status.module';
import { listenPromise } from './util/util';

process.env.DB_HOST = 'localhost';
process.env.NODE_ENV = 'development';

const PORT = 4243;
const URL = `http://localhost:${PORT}`;

describe('UserStatusModule (e2e)', () => {
  let app: INestApplication;
  let clientSocket: Socket;
  let manager: ActivityManager;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
      providers: [ActivityManager, UserSocketStorage],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
    await app.listen(PORT);
    clientSocket = io(URL, { extraHeaders: { 'x-user-id': '20000' } });
    await listenPromise(clientSocket, 'connect');
  });

  beforeEach(() => {
    manager = app.select(UserStatusModule).get(ActivityManager);
  });

  afterAll(async () => {
    await app.close();
    clientSocket.close();
  });

  it('should pass information about in which UI a user is', async () => {
    clientSocket.emit('currentUi', { ui: 'profile' });
    await waitForExpect(() => {
      expect(manager.getActivity(20000)).toEqual('profile');
    });
    clientSocket.emit('currentUi', { ui: 'ranks' });
    await waitForExpect(() => {
      expect(manager.getActivity(20000)).toEqual('ranks');
    });
    clientSocket.emit('currentUi', { ui: 'chatRooms-4242' });
    await waitForExpect(() => {
      expect(manager.getActivity(20000)).toEqual('chatRooms-4242');
    });
    clientSocket.emit('currentUi', { ui: 'waitingRoom' });
    await waitForExpect(() => {
      expect(manager.getActivity(20000)).toEqual('waitingRoom');
    });
    const gameId = nanoid();
    clientSocket.emit('currentUi', { ui: `game-${gameId}` });
    await waitForExpect(() => {
      expect(manager.getActivity(20000)).toEqual(`game-${gameId}`);
    });
  });

  it('should throw BAD REQUEST when the given current UI is unknown', async () => {
    clientSocket.emit('currentUi', { ui: 'abc' });
    clientSocket.emit('currentUi', { ui: 'chatRooms-345abc' });
    await new Promise((resolve) => setTimeout(() => resolve('done'), 500));
    expect(manager.getActivity(12311)).toBeNull();
    expect(manager.getActivity(54321)).toBeNull();
  });

  it('should contain <UserId, SocketId> & <SocketId, UserID> in UserSocketStorage', () => {
    const storage = app.select(UserStatusModule).get(UserSocketStorage);
    expect(storage.sockets.get(clientSocket.id)).toEqual(20000);
    expect(storage.clients.get(20000)).toEqual(clientSocket.id);
  });

  /*****************************************************************************
   *                                                                           *
   * SECTION : UserActivity WS event                                           *
   *                                                                           *
   ****************************************************************************/

  /** NOTE : userActivity 가 GET /user/:userId/info 를 보낸 유저들에게만 보내지는 것으로
   * 수정되면서 아래 테스트가 무의미해졌고, 해당 기능은 UserModule 테스트에서 충분히 커버된다고 생각하여
   * skip 처리
   */
  describe.skip('userActivity (WS)', () => {
    let clientSockets: Socket[];
    beforeEach(async () => {
      clientSockets = [
        io(URL, { extraHeaders: { 'x-user-id': '10000' } }),
        io(URL, { extraHeaders: { 'x-user-id': '10001' } }),
      ];
      await Promise.all(
        clientSockets.map((socket) =>
          new Promise((resolve) =>
            socket.on('connect', () => resolve(socket)),
          ).then((client: Socket) =>
            client.emit('currentUi', { ui: 'profile' }),
          ),
        ),
      );
      await waitForExpect(() => {
        expect(manager.getActivity(10000)).toEqual('profile');
        expect(manager.getActivity(10001)).toEqual('profile');
      });
    });

    afterEach(async () => clientSockets.forEach((socket) => socket.close()));

    it('should emit userActivity when a user is connected', async () => {
      const [userActivityOne, userActivityTwo] = await Promise.all([
        listenPromise(clientSockets[0], 'userActivity'),
        listenPromise(clientSockets[1], 'userActivity'),
        new Promise((resolve) => {
          const socket = io(URL, { extraHeaders: { 'x-user-id': '10002' } });
          clientSockets.push(socket);
          clientSockets[2].on('connect', () => resolve(socket));
        }).then((socket: Socket) =>
          socket.emit('currentUi', { ui: 'profile' }),
        ),
      ]);
      await waitForExpect(() =>
        expect(manager.getActivity(10002)).toEqual('profile'),
      );
      expect(userActivityOne).toEqual({
        activity: 'online',
        gameId: null,
        userId: 10002,
      });
      expect(userActivityTwo).toEqual({
        activity: 'online',
        gameId: null,
        userId: 10002,
      });
    });

    it('should emit userActivity when a user is disconnected', async () => {
      const socket = io(URL, {
        extraHeaders: { 'x-user-id': `${10002}` },
      });
      await new Promise((resolve) =>
        socket.on('connect', () => resolve(socket)),
      );
      const [userActivityOne, userActivityTwo] = await Promise.all([
        listenPromise(clientSockets[0], 'userActivity'),
        listenPromise(clientSockets[1], 'userActivity'),
        socket.close(),
      ]);
      expect(userActivityOne).toEqual({
        activity: 'offline',
        gameId: null,
        userId: 10002,
      });
      expect(userActivityTwo).toEqual({
        activity: 'offline',
        gameId: null,
        userId: 10002,
      });
    });
  });
});
