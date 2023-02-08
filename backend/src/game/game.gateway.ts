import {
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server } from 'socket.io';
import { UseInterceptors } from '@nestjs/common';

import { GameCompleteDto, GameStartedDto } from './dto/game-gateway.dto';
import { GameCompleteInterceptor } from './game.interceptor';
import { GameId, SocketId } from '../util/type';
import { GameStorage } from './game.storage';

@WebSocketGateway()
export class GameGateway {
  @WebSocketServer()
  private readonly server: Server;

  constructor(private readonly gameStorage: GameStorage) {}

  /*****************************************************************************
   *                                                                           *
   * SECTION : Public Methods                                                  *
   *                                                                           *
   ****************************************************************************/

  /**
   * @description socket room 입장
   *
   * @param socketId socket id
   * @param room 입장할 room
   */
  joinRoom(socketId: SocketId, room: `game-${GameId}` | 'waitingRoom') {
    this.server.in(socketId).socketsJoin(room);
  }

  leaveRoom(socketId: SocketId, room: `game-${GameId}` | 'waitingRoom') {
    this.server.in(socketId).socketsLeave(room);
  }

  destroyRoom(room: `game-${GameId}`) {
    this.server.socketsLeave(room);
  }

  /**
   * @description 게임 player 들에게 매칭되었다고 알림
   *
   * @param room 게임 방
   * @param gameId 게임 id
   */
  emitNewGame(room: `game-${GameId}`, gameId: GameId) {
    this.server.to(room).emit('newGame', { gameId });
  }

  /**
   * @description: 게임 옵션 전송
   *
   * @param room 게임 방
   * @param map 맵
   */
  emitGameOption(room: `game-${GameId}`, map: 1 | 2 | 3) {
    this.server.to(room).emit('gameOption', { map });
  }

  /**
   * @description 게임 시작 시, waitingRoom UI 에 있는 유저들에게 새 게임 정보 전송
   *
   * @param room waitingRoom UI 에 있는 유저들
   * @param gameStartedDto 게임 시작 정보
   */
  emitGameStarted(room: 'waitingRoom', gameStartedDto: GameStartedDto) {
    this.server.to(room).emit('gameStarted', gameStartedDto);
  }

  /**
   *
   */
  async emitGameAborted(
    room: `game-${GameId}`,
    gameId: GameId,
    abortedSide: 'left' | 'right',
  ) {
    await this.gameStorage.updateResult(
      gameId,
      abortedSide === 'left' ? [0, 5] : [5, 0],
    );
    this.server.to(room).emit('gameAborted', { abortedSide });
  }

  /**
   * @description 게임 정상 종료 시, 승자가 게임 결과를 서버에 알리는 메시지, 게임 결과 업데이트
   *
   * @param result 게임 결과
   */
  // FIXME : pipe 에서 throw 되면 gameStorage 에서 해당 게임이 지워지지 않는다
  @UseInterceptors(GameCompleteInterceptor)
  @SubscribeMessage('gameComplete')
  async handleGameComplete(@MessageBody() result: GameCompleteDto) {
    const { id, scores } = result;
    this.server.socketsLeave(`game-${id}`);
    await this.gameStorage.updateResult(id, scores);
  }

  /*****************************************************************************
   *                                                                           *
   * NOTE : TEST ONLY                                                          *
   *                                                                           *
   ****************************************************************************/

  doesRoomExist(room: `game-${GameId}`) {
    return this.server.sockets.adapter.rooms.get(room) !== undefined;
  }
}
