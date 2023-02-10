import { Server } from 'socket.io';
import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';

import { LadderUpdateDto } from './dto/ranks-gateway.dto';
import { SocketId } from '../util/type';

@WebSocketGateway()
export class RanksGateway {
  @WebSocketServer()
  private readonly server: Server;

  /**
   * @description 유저가 랭킹 UI를 보기 시작할 때, ranks room 입장
   *
   * @param socketId socket id
   */
  joinRanksRoom(socketId: SocketId) {
    this.server.in(socketId).socketsJoin('ranks');
  }

  /**
   * @description 랭킹 UI 보고 있던 유저가 랭킹 UI를 떠날 때, ranks room 퇴장
   *
   * @param socketId socket id
   */
  leaveRanksRoom(socketId: SocketId) {
    this.server.in(socketId).socketsLeave('ranks');
  }

  /**
   * @description 게임 종료 시, 랭킹 업데이트 이벤트 ranks UI 보고 있는 유저들에게 전송
   *
   * @param ladderUpdate 랭킹 업데이트 정보
   */
  emitLadderUpdate(ladderUpdate: LadderUpdateDto) {
    this.server.to('ranks').emit('ladderUpdate', ladderUpdate);
  }

  /*****************************************************************************
   *                                                                           *
   * NOTE : TEST ONLY                                                          *
   *                                                                           *
   ****************************************************************************/

  doesRanksRoomExist() {
    return this.server.sockets.adapter.rooms.get('ranks') !== undefined;
  }
}
