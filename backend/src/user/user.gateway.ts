import { Server } from 'socket.io';
import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';

import { Relationship, SocketId, UserId } from '../util/type';
import { UserActivityDto } from './dto/user-gateway.dto';

@WebSocketGateway()
export class UserGateway {
  @WebSocketServer()
  private readonly server: Server;

  /**
   * @description 유저가 수신한 friend request 수 변화 전달
   *
   * @param receiverSocketId
   * @param requestDiff
   */
  emitFriendRequestDiff(receiverSocketId: SocketId, requestDiff: 1 | -1) {
    this.server.to(receiverSocketId).emit('friendRequestDiff', { requestDiff });
  }

  /**
   * @description activity 정보 전달
   *
   * @param requesterSocketId 요청한 유저의 socket id
   * @param userActivity 요청한 유저의 activity & relationship 정보
   */
  emitUserActivity(requesterSocketId: SocketId, userActivity: UserActivityDto) {
    this.server.to(requesterSocketId).emit('userActivity', userActivity);
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
