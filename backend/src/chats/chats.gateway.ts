import { DateTime } from 'luxon';
import { Server } from 'socket.io';
import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';

import { ChannelId, SocketId, UserId, UserRole } from '../util/type';
import { UserSocketStorage } from '../user-status/user-socket.storage';

@WebSocketGateway()
export class ChatsGateway {
  @WebSocketServer()
  private server: Server;

  constructor(private userSocketStorage: UserSocketStorage) {}

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
   * @description 채팅방 입장시 해당 Room 에 join
   *
   * @param roomId 유저의 socket id
   * @param room 현재 보고있는 채팅방의 room ui
   */
  joinRoom(socketId: SocketId, room: `chatRooms-${ChannelId}`) {
    this.server.in(socketId).socketsJoin(room);
  }

  /**
   * @description 채팅방 UI 에 유저가 머무를 시 해당 activeChatRoom 에 join
   *
   * @param socketId 유저의 socket id
   * @param channelId 유저가 머무르는 채팅방의 id
   */
  joinActiveRoom(socketId: SocketId, room: `chatRooms-${ChannelId}`) {
    this.server.in(socketId).socketsJoin(room + '-active');
  }

  /**
   * @description 채팅방 UI 에서 나갈 시 해당 Room 에서 leave
   *
   * @param socketId 유저의 socket id
   * @param channelId 유저가 머무르던 채팅방의 id
   */
  leaveActiveRoom(socketId: SocketId, room: `chatRooms-${ChannelId}`) {
    this.server.in(socketId).socketsLeave(room + '-active');
  }

  /*****************************************************************************
   *                                                                           *
   * SECTION : Events when user does viewing the chatRoom-UI                   *
   *                                                                           *
   ****************************************************************************/

  /**
   * @description 새로운 멤버가 채팅방에 입장했을 때, 해당 채팅방을 보고 있는 모든 멤버에게 알림
   *
   * @param userId 입장한 유저의 id
   * @param channelId 입장한 채팅방의 id
   */
  emitMemberJoin(joinedMember: UserId, channelId: ChannelId) {
    this.server
      .in(`chatRooms-${channelId}-active`)
      .emit('memberJoin', { joinedMember });
  }

  /**
   * @description 새로운 메시지가 채팅방에 도착했을 때, 해당 채팅방을 보고 있는 모든 멤버에게 알림
   *
   * @param userId 메시지를 보낸 유저의 id
   * @param channelId 메시지를 보낸 채팅방의 id
   * @param content 메시지 내용
   * @param sentAt 메시지 작성 시간
   */
  emitNewMessage(
    senderId: UserId,
    channelId: ChannelId,
    content: string,
    sentAt: DateTime,
  ) {
    this.server
      .in(`chatRooms-${channelId}-active`)
      .emit('newMessage', { senderId, content, sentAt });
    // TODO: 여기서 emit 하는게 맞는 지 고민해보기
    this.emitMessageArrived(channelId);
  }

  /**
   * @description 멤버가 채팅방에서 나갔을 때, 해당 채팅방을 보고 있는 모든 멤버에게 알림
   *
   * @param userId 나간 멤버의 id
   * @param channelId 나간 채팅방의 id
   * @param isOwner 나간 멤버가 채팅방의 owner 인지 여부
   */
  emitMemberLeft(leftMember: UserId, channelId: ChannelId, isOwner: boolean) {
    this.server
      .in(`chatRooms-${channelId}-active`)
      .emit('memberLeft', { leftMember, isOwner });
  }

  /**
   * @description 멤버의 역할이 변경되었을 때, 해당 채팅방을 보고 있는 모든 멤버에게 알림
   *
   * @param changedMember 역할이 변경된 멤버의 id
   * @param channelId 역할이 변경된 채팅방의 id
   * @param newRole 새로운 역할
   */
  emitRoleChanged(
    changedMember: UserId,
    channelId: ChannelId,
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
   * @description 새로운 메시지가 도착 했을 때, 해당 채팅방을 보고 있지 않은 멤버에게 알림
   *
   * @param channelId 채팅방의 id
   */
  // TODO: unseenCount 생각하기, private 로 바꿀지 생각하기
  emitMessageArrived(channelId: ChannelId) {
    this.server
      .in(`chatRooms-${channelId}`)
      .except(`chatRooms-${channelId}-active`)
      .emit('messageArrived', { channelId });
  }

  /**
   * @description 멤버가 채팅방에서 mute 되었을 때, 해당 유저에게 알림
   *
   * @param mutedMember mute 된 멤버의 id
   * @param channelId mute 된 채팅방의 id
   * @param muteEndAt mute 가 해제되는 시간
   */
  emitMuted(mutedMember: UserId, channelId: ChannelId, muteEndAt: DateTime) {
    const socketId = this.userSocketStorage.clients.get(mutedMember);
    if (socketId) {
      this.server.in(socketId).emit('muted', {
        mutedMember,
        channelId,
        muteEndAt,
      });
    }
  }

  /*****************************************************************************
   *                                                                           *
   * NOTE : test Only (maybe)                                                  *
   *                                                                           *
   ****************************************************************************/
  getRoomMembers(chatRoom: string) {
    return this.server.sockets.adapter.rooms.get(chatRoom);
  }
}
