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

import { Activity, ChannelId, CurrentUi, UserId } from './../util/type';
import { ActivityManager } from './activity.manager';
import { ChannelStorage } from './channel.storage';
import { ChatsGateway } from '../chats/chats.gateway';
import { CurrentUiDto } from './dto/user-status.dto';
import { GameGateway } from '../game/game.gateway';
import { UserActivityDto } from './dto/user-status.dto';
import { UserRelationshipStorage } from './user-relationship.storage';
import { UserSocketStorage } from './user-socket.storage';

@UsePipes(
  new ValidationPipe({
    forbidNonWhitelisted: true,
    transform: true,
    whitelist: true,
  }),
)
@WebSocketGateway()
export class ActivityGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  private server: Server;

  constructor(
    private activityManager: ActivityManager,
    private channelStorage: ChannelStorage,
    private chatsGateway: ChatsGateway,
    private gameGateway: GameGateway,
    private userRelationshipStorage: UserRelationshipStorage,
    private userSocketStorage: UserSocketStorage,
  ) /**
   * private authService: AuthService,
   * private ranksGateway: RanksGateway, */ {}

  /**
   * @description websocket connection 이 생성될 때 유저 관련 데이터 케싱
   *
   * @param clientSocket
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
  }

  /**
   * @description websocket connection 이 끊길 때 자원 해제 및 타 유저들에게 activity 전달
   *
   * @param clientSocket disconnect 되는 유저의 socket
   */
  handleDisconnect(clientSocket: Socket) {
    const socketId = clientSocket.id;
    const userId = this.userSocketStorage.sockets.get(socketId);
    this.activityManager.deleteActivity(userId);
    this.userSocketStorage.clients.delete(userId);
    this.userSocketStorage.sockets.delete(socketId);
    this.userRelationshipStorage.unload(userId);
    this.channelStorage.unloadUser(userId);
    this.emitUserActivity(userId);
  }

  // @SubscribeMessage('disconnecting')
  // handleDisconnecting(clientSocket: Socket) {
  //   const { rooms } = clientSocket;
  //   rooms.forEach((room) => {
  //     if (room.startsWith('game-')) {
  //       // this.gameGateway.emitOpponentDisconnected(room);
  //     }
  //   });
  // }

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
    // NOTE : UI 에 따라 client socket 을 room 에 join
    // if (ui === 'ranks') {
    //   this.ranksGateway.joinRoom(clientSocket);
    // } else if (/chatRooms-\d+/.test(ui)) {
    //   this.chatsGateway.joinRoom(clientSocket, ui);
    // }
    const prevActivity = this.activityManager.getActivity(userId);
    this.manageRooms(clientSocket.id, userId, prevActivity, ui);
    this.activityManager.setActivity(userId, ui);
    if (!prevActivity) {
      this.emitUserActivity(userId);
    }
    // console.log(clientSocket.request.headers);
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
      activity = currentUi === 'playingGame' ? 'inGame' : 'online';
    }

    // TODO : 게임 중이라면 GameStorage 에서 gameId 가져오기
    const gameId = null;

    return {
      activity,
      gameId,
      userId: targetId,
    };
  }

  private manageRooms(
    socketId: string,
    userId: UserId,
    prevActivity: CurrentUi,
    ui: CurrentUi,
  ) {
    if (prevActivity?.startsWith('chatRooms-') === true) {
      this.chatsGateway.leaveRoom(
        socketId,
        (prevActivity + '-active') as `chatRooms-${ChannelId}-active`,
      );
    } else if (prevActivity === 'chats') {
      this.chatsGateway.leaveRoom(socketId, prevActivity);
    }

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
    }
  }
}
