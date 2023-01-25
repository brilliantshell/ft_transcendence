import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { io, Socket } from 'socket.io-client';

import { ActivityManager } from '../src/user-status/activity.manager';
import { AppModule } from './../src/app.module';
import { UserStatusModule } from './../src/user-status/user-status.module';

describe('UserStatusModule (e2e)', () => {
  let app: INestApplication;
  let clientSocket: Socket;
  let manager: ActivityManager;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
      providers: [ActivityManager],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
    await app.listen(4243);
    clientSocket = io('http://localhost:4243');
  });

  beforeEach(() => {
    manager = app.select(UserStatusModule).get(ActivityManager);
  });

  afterAll((done) => {
    setTimeout(async () => {
      await app.close();
      clientSocket.close();
      done();
    }, 4000);
  });

  it('should pass information about in which UI a user is', (done) => {
    clientSocket.emit('currentUi', { userId: '20000', ui: 'profile' });
    clientSocket.emit('currentUi', { userId: '121212', ui: 'ranks' });
    clientSocket.emit('currentUi', { userId: '10000', ui: 'chatRooms-4242' });
    clientSocket.emit('currentUi', { userId: '199999', ui: 'waitingRoom' });
    clientSocket.emit('currentUi', { userId: '42424', ui: 'playingGame' });
    setTimeout(() => {
      expect(manager.getActivity(20000)).toEqual('profile');
      manager.deleteActivity(20000);
      expect(manager.getActivity(121212)).toEqual('ranks');
      manager.deleteActivity(121212);
      expect(manager.getActivity(10000)).toEqual('chatRooms-4242');
      manager.deleteActivity(10000);
      expect(manager.getActivity(199999)).toEqual('waitingRoom');
      manager.deleteActivity(199999);
      expect(manager.getActivity(42424)).toEqual('playingGame');
      manager.deleteActivity(42424);
      done();
    }, 1000);
  });

  it('should throw BAD REQUEST when the given current UI is unknown', (done) => {
    clientSocket.emit('currentUi', { userId: 12311, ui: 'abc' });
    clientSocket.emit('currentUi', { userId: 54321, ui: 'chatRooms-345abc' });
    setTimeout(() => {
      expect(manager.getActivity(12311)).toBeNull();
      expect(manager.getActivity(54321)).toBeNull();
      done();
    }, 1000);
  });

  it('should throw BAD REQUEST when an invalid userId has been passed to Activity Gateway', (done) => {
    clientSocket.emit('currentUi', { userId: -4242, ui: 'waitingRoom' });
    clientSocket.emit('currentUi', { userId: '100000a', ui: 'profile' });
    clientSocket.emit('currentUi', { userId: 0, ui: 'chats' });
    clientSocket.emit('currentUi', { userId: '9999', ui: 'waitingRoom' });
    setTimeout(() => {
      expect(manager.getActivity(-4242)).toBeNull();
      expect(manager.getActivity(0)).toBeNull();
      expect(manager.getActivity(100000)).toBeNull();
      expect(manager.getActivity(9999)).toBeNull();
      done();
    }, 1000);
  });
});
