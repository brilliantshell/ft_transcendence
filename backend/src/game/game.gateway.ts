import {
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server } from 'socket.io';
import { UsePipes, ValidationPipe } from '@nestjs/common';

import {
  GameDataDto,
  GamePlayerYDto,
  GameStartedDto,
} from './dto/game-gateway.dto';
import { GameData, GameId, SocketId, UserId } from '../util/type';
import { GameStorage } from './game.storage';
import { RanksGateway } from '../ranks/ranks.gateway';
import { WEBSOCKET_CONFIG } from '../config/constant/constant-config';

@UsePipes(new ValidationPipe({ forbidNonWhitelisted: true, whitelist: true }))
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
   * @description ladder 게임 player 들에게 매칭되었다고 알림
   *
   * @param gameId 게임 id
   */
  emitNewGame(gameId: GameId) {
    this.server.to(`game-${gameId}`).emit('newGame', { gameId });
  }

  /**
   * @description normal 게임 에 초대된 유저에게 게임이 매칭되었다고 알림
   *
   * @param gameId 게임 id
   */
  emitNewNormalGame(gameId: GameId, inviterNickname: string) {
    this.server
      .to(`game-${gameId}`)
      .emit('newNormalGame', { gameId, inviterNickname });
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

  /**
   * @description paddle 위치가 변경된 유저의 새로운 위치를 받아 업데이트
   *
   * @param {gameId, isLeft, y} 게임 id, 어느쪽 플레이어인지 여부, 플레이어 y 좌표
   */
  @SubscribeMessage('gamePlayerY')
  handleGamePlayerY(
    @MessageBody()
    { gameId, isLeft, isUp }: GamePlayerYDto,
  ) {
    const gameInfo = this.gameStorage.getGame(gameId);
    if (gameInfo === undefined) {
      return;
    }
    const {
      gameData: { paddlePositions },
    } = gameInfo;
    const { leftY, rightY } = paddlePositions;
    if (isLeft) {
      paddlePositions.leftY = isUp
        ? Math.max(0, leftY - 0.048)
        : Math.min(0.83333, leftY + 0.048);
    } else {
      paddlePositions.rightY = isUp
        ? Math.max(0, rightY - 0.048)
        : Math.min(0.83333, rightY + 0.048);
    }
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
    const { leftId, gameData } = gameInfo;
    const { intervalId, subscription } = gameData;
    intervalId && clearInterval(intervalId);
    subscription && gameData.subscription.unsubscribe();
    await this.emitGameAborted(gameId, leftId === userId ? 'left' : 'right');
    this.server.socketsLeave(`game-${gameId}`);
  }

  /**
   * @description 현재 게임 데이터 게임방 보고 있는 유저들에게 전송
   *
   * @param gameId 게임 id
   * @param gameData 게임 정보
   */
  emitGameData(gameId: GameId, gameData: GameDataDto) {
    this.server.to(`game-${gameId}`).emit('gameData', gameData);
  }

  /**
   * @description 게임이 정상적으로 종료되었다고 플레이어들과 관전자들에게 알림
   *
   * @param gameId 게임 id
   * @param gameData 게임 정보
   */
  async emitGameComplete(gameId: GameId, gameData: GameData) {
    const { scores } = gameData;
    this.emitGameEnded(gameId);
    this.server
      .to(`game-${gameId}`)
      .emit('gameComplete', { winnerSide: scores[0] === 5 ? 'left' : 'right' });
    this.server.socketsLeave(`game-${gameId}`);
    const ladderUpdateDto = await this.gameStorage.updateResult(gameId, scores);
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
    this.gameStorage.getGame(id)?.isRank &&
      this.server.to('waitingRoom').emit('gameEnded', { id });
  }
}
