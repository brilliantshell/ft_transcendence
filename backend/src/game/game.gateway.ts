import { Server } from 'socket.io';
import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';

import { GameId, SocketId } from '../util/type';

@WebSocketGateway()
export class GameGateway {
  @WebSocketServer()
  private readonly server: Server;

  joinRoom(socketId: SocketId, room: `game-${GameId}`) {
    this.server.in(socketId).socketsJoin(room);
  }

  emitNewGame(room: `game-${GameId}`, gameId: GameId) {
    this.server.to(room).emit('newGame', { gameId });
  }

  emitGameOption(room: `game-${GameId}`, map: 1 | 2 | 3) {
    this.server.to(room).emit('gameOption', { map });
  }
}
