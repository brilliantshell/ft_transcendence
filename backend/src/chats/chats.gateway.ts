import { DateTime } from 'luxon';
import { Server } from 'socket.io';
import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';

import { WEBSOCKET_CONFIG } from '../config/constant/constant-config';
import { ChannelId, SocketId, UserId, UserRole } from '../util/type';
import { NewMessage } from './dto/chats-gateway.dto';
import { UserRelationshipStorage } from '../user-status/user-relationship.storage';
import { UserSocketStorage } from '../user-status/user-socket.storage';

@WebSocketGateway(WEBSOCKET_CONFIG)
export class ChatsGateway {
  @WebSocketServer()
  private server: Server;

  constructor(
    private userSocketStorage: UserSocketStorage,
    private readonly userRelationshipStorage: UserRelationshipStorage,
  ) {}

  /*****************************************************************************
   *                                                                           *
   * SECTION : Public methods                                                  *
   *                                                                           *
   ****************************************************************************/

  /*****************************************************************************
   *                                                                           *
   * SECTION : Managing Room                                                   *
   *                                                                           *
   ****************************************************************************/

  /**
   * @description 채널 입장시 해당 Room 에 join
   *
   * @param roomId 유저의 socket id
   * @param room 현재 보고있는 채팅방의 room ui
   */
  joinChannelRoom(channelId: ChannelId, userId: UserId) {
    const socketId = this.userSocketStorage.clients.get(userId);
    socketId && this.server.in(socketId).socketsJoin(`chatRooms-${channelId}`);
  }

  /**
   * @description 채널 나갈 시 해당 Room 에서 leave
   *
   * @param channelId 유저가 머무르던 채팅방의 id
   * @param userId 유저의 id
   */
  leaveChannelRoom(channelId: ChannelId, userId: UserId) {
    const socketId = this.userSocketStorage.clients.get(userId);
    this.server.in(socketId).socketsLeave(`chatRooms-${channelId}`);
  }

  /**
   * @description 채널 | chats UI 에 유저가 머무를 시 해당 activeChatRoom 에 join
   *
   * @param socketId 유저의 socket id
   * @param channelId 유저가 머무르는 채팅방의 id
   */
  joinRoom(
    socketId: SocketId,
    room: `chatRooms-${ChannelId}-active` | 'chats',
  ) {
    this.server.in(socketId).socketsJoin(room);
  }

  /**
   * @description 채널 | chats UI 에서 나갈 시 해당 Room 에서 leave
   *
   * @param socketId 유저의 socket id
   * @param channelId 유저가 머무르던 채팅방의 id
   */
  leaveRoom(
    socketId: SocketId,
    room: `chatRooms-${ChannelId}-active` | 'chats',
  ) {
    this.server.in(socketId).socketsLeave(room);
  }

  /*****************************************************************************
   *                                                                           *
   * SECTION : Events when user does viewing the chat-UI                       *
   *                                                                           *
   ****************************************************************************/

  /**
   * @description 새로운 채널이 생성됐을 떄, chats-UI 를 보고 있는 유저에게 알림
   *
   * @param channelId 채널의 id
   * @param channelName 채널의 이름
   * @param accessMode 채널의 접근 권한
   */
  emitChannelCreated(
    channelId: ChannelId,
    channelName: string,
    accessMode: 'public' | 'protected',
  ) {
    this.server.in('chats').emit('channelCreated', {
      channelId,
      channelName,
      accessMode,
    });
  }

  /**
   * @description 새로운 DM 이 생성됐을 때, chats-UI 를 보고 있는 상대방에게 알림
   *
   * @param channelId dm 채널의 id
   * @param channelName  dm 채널의 이름
   * @param peerId  dm 채널의 상대방 id
   */
  emitDmCreated(
    channelId: ChannelId,
    channelName: string,
    ownerId: UserId,
    peerId: UserId,
  ) {
    this.joinChannelRoom(channelId, ownerId);
    this.joinChannelRoom(channelId, peerId);
    const socketId = this.userSocketStorage.clients.get(peerId);
    if (this.getRoomMembers('chats')?.has(socketId)) {
      this.server.in(socketId).emit('channelCreated', {
        channelId,
        channelName,
        accessMode: 'private',
      });
    }
  }

  /**
   * @description 채널에 멤버가 추가/삭제 되었을 때, chats-UI 를 보고 있는 유저에게 알림
   *
   * @param channelId 참여 인원 변동이 일어난 채널
   * @param memberCountDiff 참여 인원 변동량
   * @param accessMode 채널의 접근 권한
   */
  emitChannelUpdated(
    channelId: ChannelId,
    memberCountDiff: -1 | 0 | 1 = 0,
    accessMode: 'public' | 'protected' | 'private' | null = null,
  ) {
    this.server
      .in('chats')
      .emit('channelUpdated', { channelId, memberCountDiff, accessMode });
  }

  /**
   * @description 채널이 public | protected 로 변경 되었을 때, chats-UI 를 보고 있는 유저에게 알림
   *
   * @param channelId 변경된 채널
   * @param channelName 채널의 이름
   * @param accessMode 변경된 채널의 접근 권한
   * @param memberCount 채널의 참여 인원
   */
  emitChannelShown(
    channelId: ChannelId,
    channelName: string,
    accessMode: 'public' | 'protected',
    memberCount: number,
  ) {
    this.server.in('chats').emit('channelShown', {
      channelId,
      channelName,
      memberCount,
      accessMode,
    });
  }

  /**
   * @description 채널이 private 로 변경 되었을 때, chats-UI 를 보고 있는 유저에게 알림
   *
   * @param channelId 변경된 채널
   */
  emitChannelHidden(channelId: ChannelId) {
    this.server.in('chats').emit('channelHidden', { channelId });
  }

  /*****************************************************************************
   *                                                                           *
   * SECTION : Events when user does viewing the chatRoom-UI                   *
   *                                                                           *
   ****************************************************************************/

  /**
   * @description 새로운 멤버가 채팅방에 입장했을 때, 해당 채팅방을 보고 있는 모든 멤버에게 알림
   *
   * @param channelId 입장한 채팅방의 id
   * @param joinedMember 입장한 유저의 id
   */
  emitMemberJoin(channelId: ChannelId, joinedMember: UserId) {
    this.joinChannelRoom(channelId, joinedMember);
    this.server
      .in(`chatRooms-${channelId}-active`)
      .emit('memberJoin', { joinedMember });
    this.emitChannelUpdated(channelId, 1);
  }

  /**
   * @description 새로운 메시지가 채팅방에 도착했을 때, 해당 채팅방을 보고 있는 모든 멤버에게 알림
   *
   * @param userId 메시지를 보낸 유저의 id
   * @param channelId 메시지를 보낸 채팅방의 id
   * @param messageId 메시지의 id
   * @param contents 메시지 내용
   * @param sentAt 메시지 작성 시간
   */
  emitNewMessage(
    channelId: ChannelId,
    { senderId, messageId, contents, createdAt }: NewMessage,
    blockedUsers: UserId[],
  ) {
    const blockedUserSockets = [];
    for (const blockedUser of blockedUsers) {
      const relationship = this.userRelationshipStorage.getRelationship(
        senderId,
        blockedUser,
      );
      if (relationship === 'blocked' || relationship === 'blocker') {
        blockedUserSockets.push(
          this.userSocketStorage.clients.get(blockedUser),
        );
      }
    }
    this.server
      .in(`chatRooms-${channelId}-active`)
      .except(blockedUserSockets)
      .emit('newMessage', {
        senderId,
        messageId,
        contents,
        createdAt: createdAt.toMillis(),
      });
    this.emitMessageArrived(channelId, blockedUserSockets);
  }

  /**
   * @description 멤버가 채팅방에서 나갔을 때, 해당 채팅방을 보고 있는 모든 멤버에게 알림
   *
   * @param userId 나간 멤버의 id
   * @param channelId 나간 채팅방의 id
   * @param isOwner 나간 멤버가 채팅방의 owner 인지 여부
   */
  emitMemberLeft(channelId: ChannelId, leftMember: UserId, isOwner: boolean) {
    this.leaveChannelRoom(channelId, leftMember);
    this.server
      .in(`chatRooms-${channelId}-active`)
      .emit('memberLeft', { leftMember, isOwner });
    if (isOwner) {
      this.emitChannelDeleted(channelId);
      return this.server.socketsLeave([
        `chatRooms-${channelId}`,
        `chatRooms-${channelId}-active`,
      ]);
    }
    this.emitChannelUpdated(channelId, -1);
  }

  /**
   * @description 멤버의 역할이 변경되었을 때, 해당 채팅방을 보고 있는 모든 멤버에게 알림
   *
   * @param changedMember 역할이 변경된 멤버의 id
   * @param channelId 역할이 변경된 채팅방의 id
   * @param newRole 새로운 역할
   */
  emitRoleChanged(
    channelId: ChannelId,
    changedMember: UserId,
    newRole: Exclude<UserRole, 'owner'>,
  ) {
    this.server
      .in(`chatRooms-${channelId}-active`)
      .emit('roleChanged', { changedMember, newRole });
  }

  /*****************************************************************************
   *                                                                           *
   * SECTION : Events when user does not viewing the chatRoom-UI               *
   *                                                                           *
   ****************************************************************************/

  /**
   * @description 멤버가 채팅방에서 mute 되었을 때, 해당 유저에게 알림
   *
   * @param mutedMember mute 된 멤버의 id
   * @param channelId mute 된 채팅방의 id
   * @param muteEndAt mute 가 해제되는 시간
   */
  emitMuted(channelId: ChannelId, mutedMember: UserId, muteEndAt: DateTime) {
    const socketId = this.userSocketStorage.clients.get(mutedMember);
    if (this.getRoomMembers(`chatRooms-${channelId}-active`)?.has(socketId)) {
      this.server.in(socketId).emit('muted', {
        mutedMember,
        channelId,
        muteEndAt,
      });
    }
  }

  /**
   * @description 멤버가 채팅방에서 ban 되었을 때, 해당 유저에게 알림
   *
   * @param channelId  ban 된 채팅방의 id
   * @param bannedMember ban 된 멤버의 id
   */
  emitBanned(channelId: ChannelId, bannedMember: UserId) {
    const socketId = this.userSocketStorage.clients.get(bannedMember);
    if (this.getRoomMembers('chats')?.has(socketId)) {
      this.server.in(socketId).emit('banned', { channelId });
    }
  }

  /**
   * @description 멤버가 채팅방에 초대 되었을 때, 해당 유저에게 알림
   *
   * @param channelId 초대된 채팅방의 id
   * @param invitedMember 초대된 멤버의 id
   */
  emitChannelInvited(channelId: ChannelId, invitedMember: UserId) {
    const socketId = this.userSocketStorage.clients.get(invitedMember);
    if (this.getRoomMembers('chats')?.has(socketId)) {
      this.server.in(socketId).emit('channelInvited', { channelId });
    }
  }

  /**
   * @description socket Room 에 있는 모든 멤버의 socket id 를 반환
   *
   * @param chatRoom socket Room 의 이름
   * @returns socket Room 에 있는 모든 멤버의 socket id
   */
  getRoomMembers(chatRoom: string) {
    return this.server.sockets.adapter.rooms.get(chatRoom);
  }

  /*****************************************************************************
   *                                                                           *
   * SECTION : Private Methods                                                 *
   *                                                                           *
   ****************************************************************************/

  /*****************************************************************************
   *                                                                           *
   * SECTION : Events when user does viewing the chatRoom-UI                   *
   *                                                                           *
   ****************************************************************************/

  /**
   * @description 새로운 메시지가 도착 했을 때, 해당 채팅방을 보고 있지 않은 멤버에게 알림
   *
   * @param channelId 채팅방의 id
   */
  private emitMessageArrived(
    channelId: ChannelId,
    blockedUserSockets: SocketId[],
  ) {
    this.server
      .in(`chatRooms-${channelId}`)
      .except(`chatRooms-${channelId}-active`)
      .except(blockedUserSockets)
      .emit('messageArrived', { channelId });
  }

  /**
   * @description 채널이 삭제 되었을 때, chats-UI 를 보고 있는 유저에게 알림
   *
   * @param channelId 삭제된 채널
   */
  private emitChannelDeleted(channelId: ChannelId) {
    this.server.in('chats').emit('channelDeleted', { channelId });
  }
}
