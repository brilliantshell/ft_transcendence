import {
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server } from 'socket.io';
import { UsePipes, ValidationPipe } from '@nestjs/common';

import { GameCompleteDto, GameStartedDto } from './dto/game-gateway.dto';
import { GameId, SocketId, UserId } from '../util/type';
import { GameStorage } from './game.storage';
import { RanksGateway } from '../ranks/ranks.gateway';
import { WEBSOCKET_CONFIG } from '../config/constant/constant-config';

@WebSocketGateway(WEBSOCKET_CONFIG)
export class GameGateway {
  @WebSocketServer()
  private readonly server: Server;

  constructor(
    private readonly gameStorage: GameStorage,
    private readonly ranksGateway: RanksGateway,
  ) {}

  /*****************************************************************************
   *                                                                           *
   * SECTION : Public Methods                                                  *
   *                                                                           *
   ****************************************************************************/

  /*****************************************************************************
   *                                                                           *
   * SECTION : Room management                                                 *
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

  /**
   * @description socket room 퇴장
   *
   * @param socketId socket id
   * @param room 퇴장할 room
   */
  leaveRoom(socketId: SocketId, room: `game-${GameId}` | 'waitingRoom') {
    this.server.in(socketId).socketsLeave(room);
  }

  /*****************************************************************************
   *                                                                           *
   * SECTION : Game management                                                 *
   *                                                                           *
   ****************************************************************************/

  /**
   * @description 게임 player 들에게 매칭되었다고 알림
   *
   * @param gameId 게임 id
   */
  emitNewGame(gameId: GameId, inviterNickname: string | null = null) {
    this.server
      .to(`game-${gameId}`)
      .emit(
        'newGame',
        inviterNickname ? { gameId, inviterNickname } : { gameId },
      );
  }

  /**
   * @description 게임이 취소되었다고 알림
   *
   * @param gameId 게임 id
   */
  emitGameCancelled(gameId: GameId) {
    this.server.to(`game-${gameId}`).emit(`gameCancelled`);
    this.server.socketsLeave(`game-${gameId}`);
  }

  /**
   * @description: 게임 옵션 전송
   *
   * @param gameId 게임 id
   * @param ignoreSocketId 무시할 socket id
   * @param map 맵
   */
  emitGameOption(gameId: GameId, ignoreSocketId: SocketId, map: 1 | 2 | 3) {
    this.server
      .to(`game-${gameId}`)
      .except(ignoreSocketId)
      .emit('gameOption', { map });
  }

  /**
   * @description 게임 시작 시, waitingRoom UI 에 있는 유저들에게 새 게임 정보 전송
   *
   * @param room waitingRoom UI 에 있는 유저들
   * @param gameStartedDto 게임 시작 정보
   */
  emitGameStarted(gameStartedDto: GameStartedDto) {
    this.server.to('waitingRoom').emit('gameStarted', gameStartedDto);
  }

  // TODO : gameStatus listener
  // TODO : gameStatus emitter
  // FIXME : 메시지 추가
  emitGameStatus(gameId: GameId) {
    this.server.to(`game-${gameId}`).emit('gameStatus');
  }

  /**
   * @description 게임 비정상 종료 처리
   *
   * @param gameId 게임 id
   * @param userId 플레이어 id
   */
  async abortIfPlayerLeave(gameId: GameId, userId: UserId) {
    const gameInfo = this.gameStorage.getGame(gameId);
    if (
      gameInfo === undefined ||
      (userId !== gameInfo.leftId && userId !== gameInfo.rightId)
    ) {
      return;
    }
    await this.emitGameAborted(
      gameId,
      gameInfo.leftId === userId ? 'left' : 'right',
    );
    this.server.socketsLeave(`game-${gameId}`);
  }

  /**
   * @description 게임 정상 종료 시, 승자가 게임 결과를 서버에 알리는 메시지, 게임 결과 업데이트
   *
   * @param result 게임 결과
   */
  @UsePipes(new ValidationPipe({ forbidNonWhitelisted: true, whitelist: true }))
  @SubscribeMessage('gameComplete')
  async handleGameComplete(@MessageBody() result: GameCompleteDto) {
    const { id, scores } = result;
    this.emitGameEnded(id);
    this.server.socketsLeave(`game-${id}`);
    const ladderUpdateDto = await this.gameStorage.updateResult(id, scores);
    ladderUpdateDto && this.ranksGateway.emitLadderUpdate(ladderUpdateDto);
  }

  /*****************************************************************************
   *                                                                           *
   * NOTE : TEST ONLY                                                          *
   *                                                                           *
   ****************************************************************************/

  doesRoomExist(room: `game-${GameId}` | 'waitingRoom') {
    return this.server.sockets.adapter.rooms.get(room) !== undefined;
  }

  /*****************************************************************************
   *                                                                           *
   * SECTION : Private methods                                                 *
   *                                                                           *
   ****************************************************************************/

  /**
   * @description 플레이어가 게임 방을 나거가나 연결이 끊길 경우, 결과 업데이트 및
   *              다른 플레이어와 관전자에게 알림
   *
   * @param gameId 게임 id
   * @param abortedSide 게임 종료한 쪽
   */
  private async emitGameAborted(gameId: GameId, abortedSide: 'left' | 'right') {
    this.emitGameEnded(gameId);
    const ladderUpdate = await this.gameStorage.updateResult(
      gameId,
      abortedSide === 'left' ? [0, 5] : [5, 0],
    );
    this.server.to(`game-${gameId}`).emit('gameAborted', { abortedSide });
    ladderUpdate && this.ranksGateway.emitLadderUpdate(ladderUpdate);
  }

  /**
   * @description 게임 종료 waitingRoom UI 에 있는 유저들에게 알림
   *
   * @param id 게임 id
   */
  private emitGameEnded(id: GameId) {
    this.gameStorage.getGame(id).isRank &&
      this.server.to('waitingRoom').emit('gameEnded', { id });
  }
}
