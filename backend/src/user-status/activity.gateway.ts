import {
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
} from '@nestjs/websockets';
import { Socket } from 'socket.io';
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
  constructor(
    private activityManager: ActivityManager,
    private userRelationshipStorage: UserRelationshipStorage,
    private userSocketStorage: UserSocketStorage,
    private channelStorage: ChannelStorage,
  ) {}

  async handleConnection(clientSocket: Socket) {
    const userId = Number(clientSocket.handshake.headers['x-user-id']);
    const socketId = clientSocket.id;
    this.userSocketStorage.clients.set(userId, socketId);
    this.userSocketStorage.sockets.set(socketId, userId);
    await this.userRelationshipStorage.load(userId);
    await this.channelStorage.loadUser(userId);
  }

  handleDisconnect(clientSocket: Socket) {
    const socketId = clientSocket.id;
    const userId = this.userSocketStorage.sockets.get(socketId);
    this.userSocketStorage.clients.delete(userId);
    this.userSocketStorage.sockets.delete(socketId);
    this.userRelationshipStorage.unload(userId);
    this.channelStorage.unloadUser(userId);
  }

  @SubscribeMessage('currentUi')
  handleCurrentUi(@MessageBody() { userId, ui }: CurrentUiDto) {
    // TODO : UI 에 따라 client socket 을 room 에 join
    this.activityManager.setActivity(userId, ui);
  }
}
