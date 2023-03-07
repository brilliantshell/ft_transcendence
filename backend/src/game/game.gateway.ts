import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server } from 'socket.io';
import { UseInterceptors, UsePipes, ValidationPipe } from '@nestjs/common';

import {
  BallDataDto,
  GameCompleteDto,
  GameDataDto,
  GamePlayerYDto,
  GameResetBallDto,
  GameStartedDto,
  PaddlePositionsDto,
} from './dto/game-gateway.dto';
import { GameId, Score, SocketId, UserId } from '../util/type';
import { GameResetBallInterceptor } from './interceptor/game-reset-ball.interceptor';
import { GameStorage } from './game.storage';
import { RanksGateway } from '../ranks/ranks.gateway';
import { UserSocketStorage } from '../user-status/user-socket.storage';
import { VerifiedSocket } from '../util/type';
import { WEBSOCKET_CONFIG } from '../config/constant/constant-config';

@UsePipes(new ValidationPipe({ forbidNonWhitelisted: true, whitelist: true }))
@WebSocketGateway(WEBSOCKET_CONFIG)
export class GameGateway {
  @WebSocketServer()
  private readonly server: Server;

  constructor(
    private readonly gameStorage: GameStorage,
    private readonly ranksGateway: RanksGateway,
    private readonly userSocketStorage: UserSocketStorage,
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

  /**
   * @description 게임 시작 / 점수 변경 시, 두 플레이어가 보내는 공 위치 초기화 요청 handle
   *
   * @param gameId 게임 id
   * @returns gameId
   */
  @UseInterceptors(GameResetBallInterceptor)
  @SubscribeMessage('gameResetBall')
  handleResetBall(
    @MessageBody()
    { gameId }: GameResetBallDto,
  ) {
    return gameId;
  }

  /**
   * @description 게임 시작 / 점수 변경 시, 게임 플레이어들에게 초기화된 공 위치 전송
   *
   * @param players 게임 플레이어들의 유저 id
   */
  emitGameBallDirections(players: [UserId, UserId]) {
    const directions = {
      xDirection: Math.random() > 0.5 ? 1 : -1,
      yDirection: Math.random() > 0.5 ? 1 : -1,
    };
    this.server
      .to(players.map((player) => this.userSocketStorage.clients.get(player)))
      .emit('gameBallDirections', directions);
  }

  /**
   * @description 게임 플레이어가 보내는 게임 정보 관전자에게 전송
   *
   * @param {gameId, ballData, paddlePositions, scores} 게임 id, 공 위치, 패들 위치, 점수
   */
  @SubscribeMessage('gameData')
  async handleGameData(
    @MessageBody()
    { gameId, ballData, paddlePositions, scores }: GameDataDto,
  ) {
    this.emitGameSpectate(gameId, scores, ballData, paddlePositions);
  }

  /**
   * @description paddle 위치가 변경된 유저의 새로운 위치를 받아
   *              상대 플레이어에게 변경된 paddle 위치 전송
   *
   * @param clientSocket socket
   * @param {gameId, y} 게임 id, 플레이어 y 좌표
   */
  @SubscribeMessage('gamePlayerY')
  handleGameMyY(
    @ConnectedSocket() clientSocket: VerifiedSocket,
    @MessageBody()
    { gameId, y }: GamePlayerYDto,
  ) {
    const userId =
      process.env.NODE_ENV === 'development'
        ? Math.floor(Number(clientSocket.handshake.headers['x-user-id']))
        : clientSocket.request.user.userId;
    const gameInfo = this.gameStorage.getGame(gameId);
    if (gameInfo === undefined) {
      return;
    }
    const { leftId, rightId } = gameInfo;
    this.emitGameOpponentY(
      this.userSocketStorage.clients.get(userId === leftId ? rightId : leftId),
      y,
    );
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
  @SubscribeMessage('gameComplete')
  async handleGameComplete(@MessageBody() result: GameCompleteDto) {
    const { id, scores } = result;
    this.emitGameSpectate(id, scores);
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
    this.gameStorage.getGame(id)?.isRank &&
      this.server.to('waitingRoom').emit('gameEnded', { id });
  }

  /**
   * @description 게임 플레이어가 보내는 게임 정보 관전자에게 전송
   *
   * @param gameId 게임 id
   * @param scores 점수
   * @param ballData 공 위치
   * @param paddlePositions 패들 위치
   */
  private emitGameSpectate(
    gameId: GameId,
    scores: [Score, Score],
    ballData: BallDataDto = null,
    paddlePositions: PaddlePositionsDto = null,
  ) {
    const gameInfo = this.gameStorage.getGame(gameId);
    if (gameInfo === undefined) {
      return;
    }
    const { leftId, rightId } = gameInfo;
    const leftSocketId = this.userSocketStorage.clients.get(leftId);
    const rightSocketId = this.userSocketStorage.clients.get(rightId);
    this.server
      .to(`game-${gameId}`)
      .except([leftSocketId, rightSocketId])
      .emit('gameSpectate', { ballData, paddlePositions, scores });
  }

  /**
   * @description 상대 플레이어에게 변경된 paddle 위치 전송
   *
   * @param opponentSocketId 상대 플레이어 socket id
   * @param y 상대 플레이어 y 좌표
   */
  private emitGameOpponentY(opponentSocketId: SocketId, y: number) {
    this.server.to(opponentSocketId).emit('gameOpponentY', { y });
  }
}
