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

  /**
   * @description activity & relationship 정보 전달
   *
   * @param requesterId 요청한 유저의 id
   * @param requestedId 요청받은 유저의 id
   */
  @SubscribeMessage('message')
  emitUserInfo(requesterId: UserId, requestedId: UserId) {
    let activity: Activity = 'offline';
    const currentUi = this.activityManager.getActivity(requestedId);
    if (currentUi) {
      activity = currentUi === 'playingGame' ? 'inGame' : 'online';
    }

    // TODO : 게임 중이라면 GameStorage 에서 gameId 가져오기
    const gameId = null;

    const relationship =
      this.userRelationshipStorage.getRelationship(requesterId, requestedId) ??
      'normal';

    this.server.emit('userInfo', {
      activity,
      gameId,
      relationship,
      userId: requestedId,
    });
  }
}
