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
} from '../util/type';
import { ActivityManager } from './activity.manager';
import { ChannelStorage } from './channel.storage';
import { ChatsGateway } from '../chats/chats.gateway';
import { CurrentUiDto } from './dto/user-status.dto';
import { GameGateway } from '../game/game.gateway';
import { RanksGateway } from '../ranks/ranks.gateway';
import { UserActivityDto } from './dto/user-status.dto';
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
    private readonly ranksGateway: RanksGateway,
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
  async handleConnection(clientSocket: Socket) {
    // const accessToken = clientSocket.handshake.headers.cookie
    //   .split(';')
    //   .find((cookie) => cookie.includes('access_token='))
    //   .replace('access_token=', '');
    // const userId = this.authService.verifyAccessToken(accessToken).id;
    // // NOTE : will throw error if token is invalid
    const userId = Number(clientSocket.handshake.headers['x-user-id']);
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
  handleCurrentUi(
    @ConnectedSocket() clientSocket: Socket,
    @MessageBody() { userId, ui }: CurrentUiDto,
  ) {
    // FIXME : userId 를 메시지로 받아서 처리하는게 아니라 client socket 에서 받아서 처리해야 함
    // const userId = Number(clientSocket.handshake.headers['x-user-id']);
    const prevUi = this.activityManager.getActivity(userId);
    this.activityManager.setActivity(userId, ui);
    prevUi
      ? this.leaveRooms(clientSocket.id, userId, prevUi)
      : this.emitUserActivity(userId);
    this.joinRooms(clientSocket.id, userId, ui);
  }

  /**
   * @description activity 정보 전달
   *
   * @param requesterSocketId 요청한 유저의 socket id
   * @param userActivity 요청한 유저의 activity & relationship 정보
   */
  emitUserActivity(targetId: UserId) {
    this.server.emit('userActivity', this.createUserActivityDto(targetId));
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

    // TODO : 게임 중이라면 GameStorage 에서 gameId 가져오기
    const gameId = null;

    return {
      activity,
      gameId,
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
    for (const room of rooms) {
      if (room.startsWith('game-')) {
        const userId = this.userSocketStorage.sockets.get(socketId);
        const gameId = room.replace('game-', '');
        this.gameGateway.abortIfPlayerLeave(gameId, userId);
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
  private leaveRooms(socketId: SocketId, userId: UserId, prevUi: CurrentUi) {
    if (prevUi.startsWith('chatRooms-') === true) {
      this.chatsGateway.leaveRoom(
        socketId,
        (prevUi + '-active') as `chatRooms-${ChannelId}-active`,
      );
    } else if (prevUi === 'chats') {
      this.chatsGateway.leaveRoom(socketId, prevUi);
    } else if (prevUi === 'waitingRoom') {
      this.gameGateway.leaveRoom(socketId, 'waitingRoom');
    } else if (prevUi.startsWith('game-')) {
      this.gameGateway.abortIfPlayerLeave(prevUi.replace('game-', ''), userId);
    } else if (prevUi === 'ranks') {
      this.ranksGateway.leaveRanksRoom(socketId);
    }
  }

  /**
   * @description 유저 UI 변경 시, 새로운 UI 에 맞게 room 에 join 하기
   *
   * @param socketId 유저의 socket id
   * @param userId 유저의 id
   * @param ui 새로운 UI
   */
  private joinRooms(socketId: SocketId, userId: UserId, ui: CurrentUi) {
    if (ui === 'chats') {
      this.chatsGateway.joinRoom(socketId, ui);
    } else if (ui.startsWith('chatRooms-')) {
      this.channelStorage.updateUnseenCount(
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
      /**
       * TODO
       * room 에 이벤트 보낼 일이 있기 전에 유저들이 들어가 있다고 확신할 수 없다
       * GameService & controller 구현하면서 확인하기
       */
      this.gameGateway.joinRoom(socketId, ui as `game-${GameId}`);
    } else if (ui === 'ranks') {
      this.ranksGateway.joinRanksRoom(socketId);
    }
  }
}
