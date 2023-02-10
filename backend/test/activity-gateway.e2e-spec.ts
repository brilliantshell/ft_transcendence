import { INestApplication } from '@nestjs/common';
import { Socket, io } from 'socket.io-client';
import { Test, TestingModule } from '@nestjs/testing';
import { nanoid } from 'nanoid';
import waitForExpect from 'wait-for-expect';

import { ActivityManager } from '../src/user-status/activity.manager';
import { AppModule } from '../src/app.module';
import { UserSocketStorage } from '../src/user-status/user-socket.storage';
import { UserStatusModule } from '../src/user-status/user-status.module';

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
    await app.listen(4243);
    clientSocket = io('http://localhost:4243', {
      extraHeaders: { 'x-user-id': '20000' },
    });
    await new Promise((resolve) =>
      clientSocket.on('connect', () => resolve('done')),
    );
  });

  beforeEach(() => {
    manager = app.select(UserStatusModule).get(ActivityManager);
  });

  afterAll(async () => {
    await app.close();
    clientSocket.close();
  });

  it('should pass information about in which UI a user is', async () => {
    const gameId = nanoid();
    clientSocket.emit('currentUi', { userId: '20000', ui: 'profile' });
    clientSocket.emit('currentUi', { userId: '121212', ui: 'ranks' });
    clientSocket.emit('currentUi', { userId: '10000', ui: 'chatRooms-4242' });
    clientSocket.emit('currentUi', { userId: '199999', ui: 'waitingRoom' });
    clientSocket.emit('currentUi', { userId: '42424', ui: `game-${gameId}` });
    await new Promise((resolve) => setTimeout(() => resolve('done'), 1000));
    expect(manager.getActivity(20000)).toEqual('profile');
    manager.deleteActivity(20000);
    expect(manager.getActivity(121212)).toEqual('ranks');
    manager.deleteActivity(121212);
    expect(manager.getActivity(10000)).toEqual('chatRooms-4242');
    manager.deleteActivity(10000);
    expect(manager.getActivity(199999)).toEqual('waitingRoom');
    manager.deleteActivity(199999);
    expect(manager.getActivity(42424)).toEqual(`game-${gameId}`);
    manager.deleteActivity(42424);
  });

  it('should throw BAD REQUEST when the given current UI is unknown', async () => {
    clientSocket.emit('currentUi', { userId: 12311, ui: 'abc' });
    clientSocket.emit('currentUi', { userId: 54321, ui: 'chatRooms-345abc' });

    await new Promise((resolve) => setTimeout(() => resolve('done'), 1000));
    expect(manager.getActivity(12311)).toBeNull();
    expect(manager.getActivity(54321)).toBeNull();
  });

  it('should throw BAD REQUEST when an invalid userId has been passed to Activity Gateway', async () => {
    clientSocket.emit('currentUi', { userId: -4242, ui: 'waitingRoom' });
    clientSocket.emit('currentUi', { userId: '100000a', ui: 'profile' });
    clientSocket.emit('currentUi', { userId: 0, ui: 'chats' });
    clientSocket.emit('currentUi', { userId: '9999', ui: 'waitingRoom' });
    await new Promise((resolve) => setTimeout(() => resolve('done'), 1000));
    expect(manager.getActivity(-4242)).toBeNull();
    expect(manager.getActivity(0)).toBeNull();
    expect(manager.getActivity(100000)).toBeNull();
    expect(manager.getActivity(9999)).toBeNull();
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

  describe('userActivity (WS)', () => {
    let clientSockets: Socket[];
    beforeEach(async () => {
      clientSockets = [
        io('http://localhost:4243', {
          extraHeaders: { 'x-user-id': `${10000}` },
        }),
        io('http://localhost:4243', {
          extraHeaders: { 'x-user-id': `${10001}` },
        }),
      ];
      await Promise.all(
        clientSockets.map((socket, i) =>
          new Promise((resolve) =>
            socket.on('connect', () => resolve(socket)),
          ).then((client: Socket) =>
            client.emit('currentUi', { userId: 10000 + i, ui: 'profile' }),
          ),
        ),
      );
      await waitForExpect(() => {
        expect(manager.getActivity(10000)).toEqual('profile');
        expect(manager.getActivity(10001)).toEqual('profile');
      });
    });

    afterEach(async () => {
      clientSockets.forEach((socket) => socket.close());
    });

    it('should emit userActivity when a user is connected', async () => {
      const [userActivityOne, userActivityTwo] = await Promise.all([
        new Promise((resolve) =>
          clientSockets[0].on('userActivity', (data) => resolve(data)),
        ),
        new Promise((resolve) =>
          clientSockets[1].on('userActivity', (data) => resolve(data)),
        ),
        new Promise((resolve) => {
          const socket = io('http://localhost:4243', {
            extraHeaders: { 'x-user-id': `${10002}` },
          });
          clientSockets.push(socket);
          clientSockets[2].on('connect', () => resolve(socket));
        }).then((socket: Socket) =>
          socket.emit('currentUi', { userId: 10002, ui: 'profile' }),
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
      const socket = io('http://localhost:4243', {
        extraHeaders: { 'x-user-id': `${10002}` },
      });
      await new Promise((resolve) =>
        socket.on('connect', () => resolve(socket)),
      );
      const [userActivityOne, userActivityTwo] = await Promise.all([
        new Promise((resolve) =>
          clientSockets[0].on('userActivity', (data) => resolve(data)),
        ),
        new Promise((resolve) =>
          clientSockets[1].on('userActivity', (data) => resolve(data)),
        ),
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
