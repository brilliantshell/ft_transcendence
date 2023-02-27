import { Server } from 'socket.io';
import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';

import { Relationship, SocketId, UserId } from '../util/type';
import { WEBSOCKET_CONFIG } from '../config/constant/constant-config';

@WebSocketGateway(WEBSOCKET_CONFIG)
export class UserGateway {
  @WebSocketServer()
  private readonly server: Server;

  /**
   * @description 유저가 수신한 friend request 수 변화 전달
   *
   * @param receiverSocketId
   * @param requestDiff
   */
  emitFriendRequestDiff(receiverSocketId: SocketId, requestDiff: number) {
    this.server.to(receiverSocketId).emit('friendRequestDiff', { requestDiff });
  }

  /**
   * @description 유저의 relationship 정보 전달
   *
   * @param socketId
   * @param userId
   * @param relationship
   */
  emitUserRelationship(
    socketId: SocketId,
    userId: UserId,
    relationship: Relationship | 'normal',
  ) {
    this.server.to(socketId).emit('userRelationship', { userId, relationship });
  }
}
