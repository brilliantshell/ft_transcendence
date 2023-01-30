import { Server } from 'socket.io';
import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';

import { SocketId } from '../util/type';
import { UserId } from '../util/type';
import { UserInfoDto } from './dto/user.dto';

@WebSocketGateway()
export class UserGateway {
  @WebSocketServer()
  private server: Server;

  /*****************************************************************************
   *                                                                           *
   * SECTION : User info                                                       *
   *                                                                           *
   ****************************************************************************/

  /**
   * @description activity & relationship 정보 전달
   *
   * @param socketId 요청한 유저의 socket id
   * @param userInfo 요청한 유저의 activity & relationship 정보
   */
  emitUserInfo(socketId: SocketId, userInfo: UserInfoDto) {
    this.server.to(socketId).emit('userInfo', userInfo);
  }

  /*****************************************************************************
   *                                                                           *
   * SECTION : Friends                                                         *
   *                                                                           *
   ****************************************************************************/

  /**
   * @description 친구 요청 수락 시 요청한 유저에게 어떤 유저와 친구가 됐는지 알림
   *
   * @param senderSocketId 요청한 유저의 socket id
   * @param newFriendId 요청을 수락한 유저의 id
   */
  emitFriendAccepted(senderSocketId: SocketId, newFriendId: UserId) {
    this.server.to(senderSocketId).emit('friendAccepted', { newFriendId });
  }

  /**
   * @description 친구 요청 거절 시 요청한 유저에게 어떤 유저가 요청을 거절했는지 알림
   *
   * @param senderSocketId 요청한 유저의 socket id
   * @param declinedBy 요청을 거절한 유저의 id
   */
  emitFriendDeclined(senderSocketId: SocketId, declinedBy: UserId) {
    this.server.to(senderSocketId).emit('friendDeclined', { declinedBy });
  }

  /**
   * @description 친구 요청 취소 시 취소 당한 유저에게 어떤 유저가 요청을 취소했는지 알림
   *
   * @param receiverSocketId 취소 당한 유저의 socket id
   * @param cancelledBy 요청을 취소한 유저의 id
   */
  emitFriendCancelled(receiverSocketId: SocketId, cancelledBy: UserId) {
    this.server.to(receiverSocketId).emit('friendCancelled', { cancelledBy });
  }

  /**
   * @description 친구 요청이 왔을 때 요청 받은 유저에게 알림
   *
   * @param receiverSocketId 요청 받은 유저의 socket id
   */
  emitPendingFriendRequest(receiverSocketId: SocketId, isPending: boolean) {
    this.server
      .to(receiverSocketId)
      .emit('pendingFriendRequest', { isPending });
  }

  /**
   * @description 친구가 삭제되었을 때 삭제된 유저에게 알림
   *
   * @param removedSocketId 삭제된 유저의 socket id
   * @param removedBy 삭제한 유저의 id
   */
  emitFriendRemoved(removedSocketId: SocketId, removedBy: UserId) {
    this.server.to(removedSocketId).emit('friendRemoved', { removedBy });
  }

  /*****************************************************************************
   *                                                                           *
   * SECTION : Block / unblock                                                 *
   *                                                                           *
   ****************************************************************************/

  /**
   * @description 유저가 차단되었을 때 차단당한 유저에게 누구에게 차단 됐는지 알림
   *
   * @param blockedSocketId 차단당한 유저의 socket id
   * @param blockedBy 차단한 유저의 id
   */
  emitBlocked(blockedSocketId: SocketId, blockedBy: UserId) {
    this.server.to(blockedSocketId).emit('blocked', { blockedBy });
  }

  /**
   * @description 유저가 차단 해제되었을 때 차단 해제된 유저에게 누구에게 차단 해제 됐는지 알림
   *
   * @param unblockedSocketId 차단 해제된 유저의 socket id
   * @param unblockedBy 차단 해제한 유저의 id
   */
  emitUnblocked(unblockedSocketId: SocketId, unblockedBy: UserId) {
    this.server.to(unblockedSocketId).emit('unblocked', { unblockedBy });
  }
}
