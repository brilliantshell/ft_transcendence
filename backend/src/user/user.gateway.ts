import { SocketId } from './../util/type';
import { UserInfoDto } from './dto/user-info.dto';
import { Server } from 'socket.io';
import {
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';

import { Activity, UserId } from '../util/type';
import { ActivityManager } from '../user-status/activity.manager';
import { UserRelationshipStorage } from '../user-status/user-relationship.storage';

@WebSocketGateway()
export class UserGateway {
  @WebSocketServer()
  private server: Server;

  constructor(
    private activityManager: ActivityManager,
    private userRelationshipStorage: UserRelationshipStorage,
  ) {}

  /*****************************************************************************
   *                                                                           *
   * SECTION : User info                                                       *
   *                                                                           *
   ****************************************************************************/

  /**
   * @description activity & relationship 정보 전달
   *
   * @param requesterId 요청한 유저의 id
   * @param requestedId 요청받은 유저의 id
   */
  @SubscribeMessage('message')
  emitUserInfo(socketId: SocketId, userInfoDto: UserInfoDto) {
    this.server.to(socketId).emit('userInfo', userInfoDto);
  }

  /*****************************************************************************
   *                                                                           *
   * SECTION : Friends                                                         *
   *                                                                           *
   ****************************************************************************/
}
