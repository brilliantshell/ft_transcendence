import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { UsePipes, ValidationPipe } from '@nestjs/common';

import {
  Activity,
  ChannelId,
  CurrentUi,
  GameId,
  SocketId,
  UserId,
  VerifiedSocket,
} from '../util/type';
import { ActivityManager } from './activity.manager';
import { ChannelStorage } from './channel.storage';
import { ChatsGateway } from '../chats/chats.gateway';
import { CurrentUiDto } from './dto/user-status.dto';
import { GameGateway } from '../game/game.gateway';
import { GameStorage } from '../game/game.storage';
import { RanksGateway } from '../ranks/ranks.gateway';
import { UserActivityDto } from './dto/user-status.dto';
import { UserGateway } from '../user/user.gateway';
import { UserRelationshipStorage } from './user-relationship.storage';
import { UserSocketStorage } from './user-socket.storage';
import { WEBSOCKET_CONFIG } from '../config/constant/constant-config';

@UsePipes(
  new ValidationPipe({
    forbidNonWhitelisted: true,
    transform: true,
    whitelist: true,
  }),
)
@WebSocketGateway(WEBSOCKET_CONFIG)
export class ActivityGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  private readonly server: Server;

  constructor(
    private readonly activityManager: ActivityManager,
    private readonly channelStorage: ChannelStorage,
    private readonly chatsGateway: ChatsGateway,
    private readonly gameGateway: GameGateway,
    private readonly gameStorage: GameStorage,
    private readonly ranksGateway: RanksGateway,
    private readonly userGateway: UserGateway,
    private readonly userRelationshipStorage: UserRelationshipStorage,
    private readonly userSocketStorage: UserSocketStorage,
  ) {}

  /*****************************************************************************
   *                                                                           *
   * SECTION : Public Methods                                                  *
   *                                                                           *
   ****************************************************************************/

  /**
   * @description websocket connection 이 생성될 때 유저 관련 데이터 케싱
   *
   * @param clientSocket connect 된 socket
   */
  async handleConnection(clientSocket: VerifiedSocket) {
    const userId =
      process.env.NODE_ENV === 'development'
        ? Math.floor(Number(clientSocket.handshake.headers['x-user-id']))
        : clientSocket.request.user.userId;
    if (process.env.NODE_ENV === 'development' && isNaN(userId)) {
      return;
    }
    const socketId = clientSocket.id;
    this.userSocketStorage.clients.set(userId, socketId);
    this.userSocketStorage.sockets.set(socketId, userId);
    await Promise.all([
      this.userRelationshipStorage.load(userId),
      this.channelStorage.loadUser(userId),
    ]);
    const joinedChannels = this.channelStorage.getUser(userId)?.keys();
    if (joinedChannels !== undefined) {
      for (const channelId of joinedChannels) {
        this.chatsGateway.joinChannelRoom(channelId, userId);
      }
    }
    const pendingRequestCount =
      this.userRelationshipStorage.countPendingRequests(userId);
    if (pendingRequestCount !== -1) {
      this.userGateway.emitFriendRequestDiff(socketId, pendingRequestCount);
    }
    clientSocket.on('disconnecting', () =>
      this.handleDisconnecting(clientSocket.id, clientSocket.rooms),
    );
  }

  /**
   * @description websocket connection 이 끊길 때 자원 해제 및 타 유저들에게 activity 전달
   *
   * @param clientSocket disconnect 되는 유저의 socket
   */
  handleDisconnect({ id: socketId }: Socket) {
    const userId = this.userSocketStorage.sockets.get(socketId);
    this.activityManager.deleteActivity(userId);
    this.userSocketStorage.clients.delete(userId);
    this.userSocketStorage.sockets.delete(socketId);
    this.userRelationshipStorage.unload(userId);
    this.channelStorage.unloadUser(userId);
    this.emitUserActivity(userId);
  }

  /**
   * @description 유저가 어떤 UI 에 있는지 client 로 부터 받아서 해당 UI 에 맞는 작업 수행
   *
   * @param clientSocket 유저의 socket
   * @param { userId, ui } 유저 아이디, UI 이름
   */
  @SubscribeMessage('currentUi')
  async handleCurrentUi(
    @ConnectedSocket() clientSocket: VerifiedSocket,
    @MessageBody() { ui }: CurrentUiDto,
  ) {
    const userId =
      process.env.NODE_ENV === 'development'
        ? Math.floor(Number(clientSocket.handshake.headers['x-user-id']))
        : clientSocket.request.user.userId;
    const prevUi = this.activityManager.getActivity(userId);
    this.activityManager.setActivity(userId, ui);
    prevUi
      ? await this.leaveRooms(clientSocket.id, userId, prevUi)
      : this.emitUserActivity(userId);
    await this.joinRooms(clientSocket.id, userId, ui);
    return 'OK';
  }

  /**
   * @description 유저가 친구 리스트 토글을 열었을 때 소켓룸 관리
   *
   * @param clientSocket 유저의 socket
   */
  @SubscribeMessage('friendListOpened')
  handleFriendListOpened(@ConnectedSocket() clientSocket: VerifiedSocket) {
    this.activityManager.friendListOpenedBy.add(
      process.env.NODE_ENV === 'development'
        ? Math.floor(Number(clientSocket.handshake.headers['x-user-id']))
        : clientSocket.request.user.userId,
    );
  }

  /**
   * @description 유저가 친구 리스트 토글을 닫았을 때 소켓룸 관리
   *
   * @param clientSocket 유저의 socket
   */
  @SubscribeMessage('friendListClosed')
  handleFriendListClosed(@ConnectedSocket() clientSocket: VerifiedSocket) {
    const userId =
      process.env.NODE_ENV === 'development'
        ? Math.floor(Number(clientSocket.handshake.headers['x-user-id']))
        : clientSocket.request.user.userId;
    this.activityManager.friendListOpenedBy.delete(userId);
    const currentUiWatchedList = this.activityManager.getWatchedUsers(
      this.activityManager.getActivity(userId),
      userId,
    );
    this.activityManager
      .getFriendWatchedUsers(userId)
      .forEach(
        (watchedId) =>
          !currentUiWatchedList.includes(watchedId) &&
          this.server.in(clientSocket.id).socketsLeave(`activity-${watchedId}`),
      );
    this.activityManager.deleteFriendWatchingUser(userId);
  }

  /**
   * @description activity 정보 전달
   *
   * @param targetId 요청한 유저의 ID
   */
  emitUserActivity(targetId: UserId) {
    this.server
      .to(`activity-${targetId}`)
      .emit('userActivity', this.createUserActivityDto(targetId));
  }

  /**
   * @description 유저가 특정 유저의 유저 컴포넌트를 보면 그 유저의 activity room 에 join
   *
   * @param socketId 요청한 유저의 socket id
   * @param requesterId 요청한 유저의 id
   * @param targetId activity 변화 시 알림을 받을 유저의 id
   */
  joinActivityRoom(socketId: SocketId, requesterId: UserId, targetId: UserId) {
    this.server.in(socketId).socketsJoin(`activity-${targetId}`);
    this.activityManager.friendListOpenedBy.has(requesterId)
      ? this.activityManager.setFriendWatchingUser(targetId, requesterId)
      : this.activityManager.setWatchingUser(
          this.activityManager.getActivity(requesterId),
          targetId,
          requesterId,
        );
  }

  /*****************************************************************************
   *                                                                           *
   * SECTION : Private Methods                                                 *
   *                                                                           *
   ****************************************************************************/

  /**
   * @description 유저의 상태 정보를 담은 UserActivityDto 를 생성
   *
   * @param targetId 조회 대상 유저의 id
   * @returns
   */
  private createUserActivityDto(targetId: UserId): UserActivityDto {
    let activity: Activity = 'offline';
    const currentUi = this.activityManager.getActivity(targetId);
    if (currentUi) {
      activity = currentUi.startsWith('game-') ? 'inGame' : 'online';
    }
    const gameId = this.gameStorage.players.get(targetId) ?? null;
    return {
      activity,
      gameId: activity === 'inGame' ? gameId : null,
      userId: targetId,
    };
  }

  /**
   * @description 유저의 socket 이 disconnecting 되었을 때 처리
   *
   * @param socketId 유저의 socket id
   * @param rooms 유저의 socket 이 속한 room 목록
   */
  handleDisconnecting(socketId: SocketId, rooms: Set<string>) {
    const userId = this.userSocketStorage.sockets.get(socketId);
    this.gameStorage.matchedPair.length = 0;
    this.gameStorage.deleteUserFromLadderQueue(userId);
    for (const room of rooms) {
      if (room.startsWith('game-')) {
        this.gameGateway.abortIfPlayerLeave(room.replace('game-', ''), userId);
        break;
      }
    }
  }

  /**
   * @description 유저 UI 변경 시, 이전에 있던 UI 에 따라 room 에서 나가기
   *
   * @param socketId 유저의 socket id
   * @param userId 유저의 id
   * @param prevUi 이전 UI
   */
  private async leaveRooms(
    socketId: SocketId,
    userId: UserId,
    prevUi: CurrentUi,
  ) {
    if (prevUi === 'chats') {
      this.chatsGateway.leaveRoom(socketId, prevUi);
    } else if (prevUi === 'waitingRoom') {
      this.gameStorage.matchedPair.length = 0;
      this.gameStorage.deleteUserFromLadderQueue(userId);
      this.gameGateway.leaveRoom(socketId, 'waitingRoom');
    } else if (prevUi.startsWith('game-')) {
      this.gameGateway.abortIfPlayerLeave(prevUi.replace('game-', ''), userId);
    } else {
      if (prevUi === 'ranks') {
        this.ranksGateway.leaveRanksRoom(socketId);
      } else if (prevUi.startsWith('chatRooms-') === true) {
        this.chatsGateway.leaveRoom(
          socketId,
          (prevUi + '-active') as `chatRooms-${ChannelId}-active`,
        );
        await this.channelStorage.updateUnseenCount(
          Math.floor(Number(prevUi.split('-')[1])),
          userId,
          true,
        );
      }
      this.activityManager
        .getWatchedUsers(prevUi, userId)
        .forEach((watchedUserId) =>
          this.server.in(socketId).socketsLeave(`activity-${watchedUserId}`),
        );
      this.activityManager.deleteWatchingUser(prevUi, userId);
    }
  }

  /**
   * @description 유저 UI 변경 시, 새로운 UI 에 맞게 room 에 join 하기
   *
   * @param socketId 유저의 socket id
   * @param userId 유저의 id
   * @param ui 새로운 UI
   */
  private async joinRooms(socketId: SocketId, userId: UserId, ui: CurrentUi) {
    if (ui === 'chats') {
      this.chatsGateway.joinRoom(socketId, ui);
    } else if (ui.startsWith('chatRooms-')) {
      await this.channelStorage.updateUnseenCount(
        Number(ui.split('-')[1]),
        userId,
        true,
      );
      this.chatsGateway.joinRoom(
        socketId,
        (ui + '-active') as `chatRooms-${ChannelId}-active`,
      );
    } else if (ui === 'waitingRoom') {
      this.gameGateway.joinRoom(socketId, 'waitingRoom');
    } else if (ui.startsWith('game-')) {
      this.gameGateway.joinRoom(socketId, ui as `game-${GameId}`);
    } else if (ui === 'ranks') {
      this.ranksGateway.joinRanksRoom(socketId);
    }
  }
}
