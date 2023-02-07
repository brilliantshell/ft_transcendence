import { DateTime } from 'luxon';
import { INestApplication } from '@nestjs/common';
import { Socket, io } from 'socket.io-client';
import { Test, TestingModule } from '@nestjs/testing';

import { AppModule } from '../src/app.module';
import { ChannelMembers } from './../src/entity/channel-members.entity';
import { Channels } from './../src/entity/channels.entity';
import { ChatsGateway } from './../src/chats/chats.gateway';
import {
  LeftMessage,
  MemberJoinedMessage,
  MutedMessage,
  NewMessage,
  RoleChangedMessage,
} from '../src/chats/dto/chats-gateway.dto';
import { Users } from './../src/entity/users.entity';
import {
  createChannelMember,
  generateUsers,
  generateChannels,
} from './generate-mock-data';
import { timeout } from './util';

describe('ChatsGateway (e2e)', () => {
  let app: INestApplication;
  let chatsGateway: ChatsGateway;
  let users: Users[];
  let channel: Channels;
  let channelMembers: ChannelMembers[];
  let clientSockets: Socket[];

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    await app.init();
    await app.listen(4245);

    chatsGateway = moduleFixture.get(ChatsGateway);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    users = generateUsers(3);
    channel = generateChannels([users[0]])[0];
    channel.channelId = 1;
    channelMembers = [
      createChannelMember(users[0].userId, channel.channelId, true),
    ];
    clientSockets = users.map((user) => {
      return io('http://localhost:4245', {
        extraHeaders: {
          'x-user-id': user.userId.toString(),
        },
      });
    });
    await Promise.all(
      clientSockets.map(
        (clientSocket) =>
          new Promise((resolve) =>
            clientSocket.on('connect', () => resolve('done')),
          ),
      ),
    );
  });

  afterEach(async () => {
    users = [];
    channel = null;
    channelMembers = [];
    for (const clientSocket of clientSockets) {
      clientSocket.close();
    }
  });

  /*****************************************************************************
   *                                                                           *
   * SECTION : join Rooms                                                      *
   *                                                                           *
   ****************************************************************************/

  it('should join room', async () => {
    // case: user[0] is member of the chatRooms-1
    // when: user[0] view the chatRooms-1 UI
    // then: users should join the chatRooms-1

    chatsGateway.joinChannelRoom(1, users[0].userId);

    clientSockets[0].emit('currentUi', {
      userId: users[0].userId,
      ui: `chatRooms-${channel.channelId}`,
    });

    await new Promise((resolve) => setTimeout(() => resolve('done'), 1000));
    expect(
      chatsGateway.getRoomMembers(`chatRooms-${channel.channelId}`).size,
    ).toBe(1);
    expect(
      chatsGateway
        .getRoomMembers(`chatRooms-${channel.channelId}`)
        .has(clientSockets[0].id),
    );

    expect(
      chatsGateway.getRoomMembers(`chatRooms-${channel.channelId}-active`).size,
    ).toBe(1);
    expect(
      chatsGateway
        .getRoomMembers(`chatRooms-${channel.channelId}-active`)
        .has(clientSockets[0].id),
    ).toBeTruthy();
  });

  it('should join chatRoom but not in chatRoom-activity', async () => {
    // case: users are join the chatRooms-1 & viewing the chatRooms-1 UI
    // when: user[1] visits the profile UI
    // then: user[1] should join the chatRooms-1 but not in chatRoom-activity
    clientSockets.forEach((_, index) =>
      chatsGateway.joinChannelRoom(1, users[index].userId),
    );
    clientSockets.forEach((clientSocket, index) => {
      clientSocket.emit('currentUi', {
        userId: users[index].userId,
        ui: `chatRooms-${channel.channelId}`,
      });
    });
    clientSockets[1].emit('currentUi', {
      userId: users[1].userId,
      ui: 'profile',
    });
    await new Promise((resolve) => setTimeout(() => resolve('done'), 1000));
    expect(
      chatsGateway.getRoomMembers(`chatRooms-${channel.channelId}`).size,
    ).toBe(3);
    clientSockets.forEach((clientSocket) =>
      expect(
        chatsGateway
          .getRoomMembers(`chatRooms-${channel.channelId}`)
          .has(clientSocket.id),
      ).toBeTruthy(),
    );

    expect(
      chatsGateway.getRoomMembers(`chatRooms-${channel.channelId}-active`).size,
    ).toBe(2);
    clientSockets.forEach((clientSocket, index) => {
      expect(
        chatsGateway
          .getRoomMembers(`chatRooms-${channel.channelId}-active`)
          .has(clientSocket.id),
      ).toBe(index !== 1);
    });
  });

  it('should join & leave chats room', async () => {
    // case: users are viewing the chats UI
    // when: user[0] visits the profile UI
    // then: user[0] should not join the chats room but remains are
    clientSockets.forEach((clientSocket, index) => {
      clientSocket.emit('currentUi', {
        userId: users[index].userId,
        ui: 'chats',
      });
    });
    clientSockets[0].emit('currentUi', {
      userId: users[0].userId,
      ui: 'profile',
    });
    await new Promise((resolve) => setTimeout(() => resolve('done'), 1000));
    expect(chatsGateway.getRoomMembers(`chats`).size).toBe(2);
    clientSockets.forEach((clientSocket, index) => {
      expect(chatsGateway.getRoomMembers(`chats`).has(clientSocket.id)).toBe(
        index !== 0,
      );
    });
  });

  /*****************************************************************************
   *                                                                           *
   * SECTION : events in chatRoom                                              *
   *                                                                           *
   ****************************************************************************/
  it('should send a memberJoined event to the chatRoom', async () => {
    // case: users[0] is member of chat,
    //   users[1] is not member of chat but will join (viewing profile UI),
    //   users[2] is member of chat but viewing chats UI
    // when: users[0] views chatRoom-1 UI, users[1] join chatRoom-1
    // then: users[0] got memberJoined event,
    //   users[2] got channelUpdated event

    chatsGateway.joinChannelRoom(1, users[0].userId);
    clientSockets[0].emit('currentUi', {
      userId: users[0].userId,
      ui: `chatRooms-${channel.channelId}`,
    });
    clientSockets[1].emit('currentUi', {
      userId: users[1].userId,
      ui: `profile`,
    });
    clientSockets[2].emit('currentUi', {
      userId: users[2].userId,
      ui: `chats`,
    });

    await new Promise((resolve) => setTimeout(() => resolve('done'), 1000));
    chatsGateway.emitMemberJoin(channel.channelId, users[1].userId);
    const joinMsg = await new Promise<MemberJoinedMessage>((resolve) =>
      clientSockets[0].on('memberJoin', (data) => resolve(data)),
    );
    expect(joinMsg).toEqual({ joinedMember: users[1].userId });

    timeout(
      1000,
      new Promise<MemberJoinedMessage>((resolve) =>
        clientSockets[2].on('memberJoin', (data) => resolve(data)),
      ),
    )
      .then((data) => expect(data).toBeUndefined())
      .catch((err) => expect(err).toBe('timeout'));

    const channelUpdatedMsg = await new Promise((resolve) =>
      clientSockets[2].on('channelUpdated', (data) => resolve(data)),
    );
    expect(channelUpdatedMsg).toEqual({ channelId: 1, memberCountDiff: 1 });
  });

  it('should send newMessage and messageArrived events to appropriate users', async () => {
    // case: users are member of chat
    //   and user[0] and user[1] are viewing chatRoom-1, user[2] is not
    // when: users[0] write message
    // then: users[0] got newMessage event and users[2] got messageArrived event
    clientSockets.forEach((_, index) =>
      chatsGateway.joinChannelRoom(1, users[index].userId),
    );
    clientSockets.forEach((clientSocket, index) => {
      clientSocket.emit('currentUi', {
        userId: users[index].userId,
        ui: `chatRooms-${channel.channelId}`,
      });
    });
    clientSockets[2].emit('currentUi', {
      userId: users[2].userId,
      ui: `chatRooms-${channel.channelId + 1}`,
    });
    const sentMsg: NewMessage = {
      senderId: users[0].userId,
      content: 'nice to meet you',
      sentAt: DateTime.now(),
    };
    await new Promise((resolve) => setTimeout(() => resolve('done'), 1000));
    chatsGateway.emitNewMessage(
      channel.channelId,
      sentMsg.senderId,
      sentMsg.content,
      sentMsg.sentAt,
    );
    const recvMsg = await Promise.all([
      new Promise<NewMessage>((resolve) =>
        clientSockets[0].on('newMessage', (msg) => resolve(msg)),
      ),
      new Promise<NewMessage>((resolve) =>
        clientSockets[1].on('newMessage', (msg) => resolve(msg)),
      ),
    ]);
    sentMsg.sentAt = sentMsg.sentAt.toString() as any;
    expect(recvMsg[0]).toEqual(recvMsg[1]);
    expect(recvMsg[1]).toEqual(sentMsg);
    expect(
      await new Promise<{ channelId: number }>((resolve) =>
        clientSockets[2].on('messageArrived', (msg) => resolve(msg)),
      ),
    ).toEqual({ channelId: channel.channelId });
  });

  it('should send a memberLeft event to the chatRoom (not owner)', async () => {
    // case: users are member of chat and are viewing chatRoom-1 UI
    // when: user[2] leave chatRoom-1
    // then: remaining users got memberLeft event
    channelMembers.push(
      createChannelMember(users[1].userId, channel.channelId),
      createChannelMember(users[2].userId, channel.channelId),
    );

    clientSockets.forEach((clientSocket, index) => {
      clientSocket.emit('currentUi', {
        userId: users[index].userId,
        ui: `chatRooms-${channel.channelId}`,
      });
    });
    const { memberId, channelId, isAdmin } = channelMembers[2];

    await new Promise((resolve) => setTimeout(() => resolve('done'), 1000));
    chatsGateway.emitMemberLeft(channelId, memberId, isAdmin);
    const leftMsg = await Promise.all([
      new Promise<LeftMessage>((resolve) =>
        clientSockets[0].on('memberLeft', (msg) => resolve(msg)),
      ),
      new Promise<LeftMessage>((resolve) =>
        clientSockets[1].on('memberLeft', (msg) => resolve(msg)),
      ),
    ]);
    expect(leftMsg[0]).toEqual(leftMsg[1]);
    expect(leftMsg[1]).toEqual({
      leftMember: memberId,
      isOwner: isAdmin,
    });
  });

  it('should send a roleChanged event to the chatRoom', async () => {
    // case: users are member of chat and are viewing chatRoom-1 UI
    // when: the role of user[2] is changed (member -> admin)
    // then: All users got roleChanged event

    channelMembers.push(
      createChannelMember(users[1].userId, channel.channelId),
      createChannelMember(users[2].userId, channel.channelId),
    );

    clientSockets.forEach((clientSocket, index) => {
      clientSocket.emit('currentUi', {
        userId: users[index].userId,
        ui: `chatRooms-${channel.channelId}`,
      });
    });
    const { memberId, channelId } = channelMembers[2];

    await new Promise((resolve) => setTimeout(() => resolve('done'), 1000));
    chatsGateway.emitRoleChanged(channelId, memberId, 'admin');
    const msg = await Promise.all(
      clientSockets.map(
        (clientSocket) =>
          new Promise<RoleChangedMessage>((resolve) =>
            clientSocket.on('roleChanged', (msg) => resolve(msg)),
          ),
      ),
    );
    expect(msg[0]).toEqual(msg[1]);
    expect(msg[1]).toEqual(msg[2]);
    expect(msg[2]).toEqual({
      changedMember: memberId,
      newRole: 'admin',
    });
  });

  it('should send a muted event to the user', async () => {
    // case: users are member of chat and are viewing chatRoom-1 UI
    // when: user[2] is muted
    // then: user[2] got muted event, other users got nothing

    channelMembers.push(
      createChannelMember(users[1].userId, channel.channelId),
      createChannelMember(users[2].userId, channel.channelId),
    );

    clientSockets.forEach((clientSocket, index) => {
      clientSocket.emit('currentUi', {
        userId: users[index].userId,
        ui: `chatRooms-${channel.channelId}`,
      });
    });
    const { memberId, channelId } = channelMembers[2];
    const muteEndAt = DateTime.now().plus({ minutes: 10 });

    await new Promise((resolve) => setTimeout(() => resolve('done'), 1000));
    chatsGateway.emitMuted(channelId, memberId, muteEndAt);
    const msg = await new Promise<MutedMessage>((resolve) =>
      clientSockets[2].on('muted', (msg) => resolve(msg)),
    );
    expect(msg).toEqual({
      mutedMember: memberId,
      channelId,
      muteEndAt: muteEndAt.toString(),
    });

    timeout(
      1000,
      new Promise<MutedMessage>((resolve) =>
        clientSockets[0].on('muted', (data) => resolve(data)),
      ),
    )
      .then((data) => expect(data).toBeUndefined())
      .catch((err) => expect(err).toBe('timeout'));

    timeout(
      1000,
      new Promise<MutedMessage>((resolve) =>
        clientSockets[1].on('muted', (data) => resolve(data)),
      ),
    )
      .then((data) => expect(data).toBeUndefined())
      .catch((err) => expect(err).toBe('timeout'));
  });
});
