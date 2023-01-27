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

import { ActivityManager } from './activity.manager';
import { ChannelStorage } from './channel.storage';
import { CurrentUiDto } from './dto/current-ui.dto';
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
    private userRelationshipStorage: UserRelationshipStorage,
    private userSocketStorage: UserSocketStorage,
    private channelStorage: ChannelStorage,
  ) /**
   * private authService: AuthService,
   * private gameGateway: GameGateway,
   * private chatsGateway: ChatsGateway,
   * private ranksGateway: RanksGateway,
   */ {}

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
  }

  handleDisconnect(clientSocket: Socket) {
    const socketId = clientSocket.id;
    const userId = this.userSocketStorage.sockets.get(socketId);
    this.userSocketStorage.clients.delete(userId);
    this.userSocketStorage.sockets.delete(socketId);
    this.userRelationshipStorage.unload(userId);
    this.channelStorage.unloadUser(userId);
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
    this.activityManager.setActivity(userId, ui);
    console.log(clientSocket.request.headers);
  }
}
