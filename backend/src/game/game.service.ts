import {
  ForbiddenException,
  Inject,
  Injectable,
  forwardRef,
} from '@nestjs/common';
import { nanoid } from 'nanoid';

import { ActivityGateway } from '../user-status/activity.gateway';
import { GameEngine } from './game.engine';
import { GameGateway } from './game.gateway';
import { GameId, GameInfo, UserId } from '../util/type';
import { GameStorage } from './game.storage';
import { UserRelationshipStorage } from '../user-status/user-relationship.storage';
import { UserSocketStorage } from '../user-status/user-socket.storage';

@Injectable()
export class GameService {
  constructor(
    private readonly activityGateway: ActivityGateway,
    private readonly gameEngine: GameEngine,
    @Inject(forwardRef(() => GameGateway))
    private readonly gameGateway: GameGateway,
    private readonly gameStorage: GameStorage,
    private readonly userRelationshipStorage: UserRelationshipStorage,
    private readonly userSocketStorage: UserSocketStorage,
  ) {}

  /*****************************************************************************
   *                                                                           *
   * SECTION : Public methods                                                  *
   *                                                                           *
   ****************************************************************************/

  /**
   * @description 현재 진행중인 ladder 게임 목록 반환
   *
   * @returns 현재 진행중인 게임 목록
   */
  findLadderGames() {
    const games = [];
    this.gameStorage
      .getGames()
      .forEach(({ leftNickname, rightNickname, isRank }, gameId) => {
        isRank &&
          games.push({ id: gameId, left: leftNickname, right: rightNickname });
      });
    return { games: games.reverse() };
  }

  /**
   * @description 관전을 요청하는 유저에게 게임의 기본 정보 제공 및 해당 게임 room 에 소켓 추가
   *
   * @param spectatorId 관전자 id
   * @param gameId 게임 id
   * @param gameInfo 게임 정보
   * @returns 게임의 기본 정보
   */
  findGameInfo(spectatorId: UserId, gameId: GameId, gameInfo: GameInfo) {
    const { leftId, leftNickname, rightId, rightNickname, mode, isRank } =
      gameInfo;
    const [leftRelationship, rightRelationship] = [
      this.userRelationshipStorage.getRelationship(spectatorId, leftId),
      this.userRelationshipStorage.getRelationship(spectatorId, rightId),
    ];
    if (
      !isRank &&
      (leftRelationship?.startsWith('block') ||
        rightRelationship?.startsWith('block'))
    ) {
      throw new ForbiddenException(
        `The requester(${spectatorId}) is either blocked by or a blocker of a game participant`,
      );
    }
    this.gameGateway.joinRoom(
      this.userSocketStorage.clients.get(spectatorId),
      `game-${gameId}`,
    );
    return {
      isRank,
      leftPlayer: leftNickname,
      rightPlayer: rightNickname,
      mode,
    };
  }

  /**
   * @description 게임에 참여하는 유저에게 게임의 기본 정보 제공
   *
   * @param playerId 요청을 보낸 플레이어 id
   * @param gameId 게임 id
   * @param gameInfo 게임 정보
   * @returns 게임의 기본 정보
   */
  findPlayers(playerId: UserId, gameId: GameId, gameInfo: GameInfo) {
    const { isRank, leftId, leftNickname, rightId, rightNickname } = gameInfo;
    const isLeft = leftId === playerId;
    const [playerNickname, opponentId, opponentNickname] = isLeft
      ? [leftNickname, rightId, rightNickname]
      : [rightNickname, leftId, leftNickname];
    if (
      !isRank &&
      rightId === playerId &&
      this.gameStorage.players.get(playerId) === gameId
    ) {
      this.gameGateway.emitGameInvitedJoined(
        this.userSocketStorage.clients.get(leftId),
      );
    }
    return {
      isRank,
      isLeft,
      playerId,
      playerNickname,
      opponentId,
      opponentNickname,
    };
  }

  /**
   * @description 일반 게임 생성
   *
   * @param inviterId 게임 초대자 id
   * @param invitedId 게임 초대받은 id
   * @returns 생성된 게임의 id
   */
  async createNormalGame(inviterId: UserId, invitedId: UserId) {
    const gameId = nanoid();
    await this.gameStorage.createGame(
      gameId,
      new GameInfo(inviterId, invitedId, 0, false),
    );
    this.gameGateway.joinRoom(
      this.userSocketStorage.clients.get(invitedId),
      `game-${gameId}`,
    );
    this.gameGateway.emitNewNormalGame(
      gameId,
      this.gameStorage.getGame(gameId).leftNickname,
    );
    this.gameGateway.joinRoom(
      this.userSocketStorage.clients.get(inviterId),
      `game-${gameId}`,
    );
    return gameId;
  }

  /**
   * @description 래더 게임 생성
   *
   * @param players 래더 게임에 참여할 플레이어들의 id
   */
  async createLadderGame(players: [UserId, UserId]) {
    const gameId = nanoid();
    await this.gameStorage.createGame(
      gameId,
      new GameInfo(players[0], players[1], 0, true),
    );
    players.forEach((userId) =>
      this.gameGateway.joinRoom(
        this.userSocketStorage.clients.get(userId),
        `game-${gameId}`,
      ),
    );
    this.gameGateway.emitNewGame(gameId);
  }

  /**
   * @description 게임 맵 변경
   *
   * @param requesterId 요청자 id
   * @param gameId 게임 id
   * @param gameInfo 게임 정보
   * @param mode 게임 모드
   */
  changeMode(
    requesterId: UserId,
    gameId: GameId,
    gameInfo: GameInfo,
    mode: 0 | 1 | 2,
  ) {
    if (gameInfo.leftId !== requesterId) {
      throw new ForbiddenException(
        `The invited player(${requesterId}) cannot change game options`,
      );
    }
    gameInfo.mode = mode;
    this.gameGateway.emitGameOption(
      gameId,
      this.userSocketStorage.clients.get(gameInfo.leftId),
      mode,
    );
  }

  /**
   * @description 게임 시작
   *
   * @param gameId 게임 id
   * @param gameInfo 게임 정보
   */
  startGame(gameId: GameId, gameInfo: GameInfo) {
    const {
      isStarted,
      gameData,
      leftNickname,
      rightNickname,
      mode,
      leftId,
      rightId,
    } = gameInfo;
    if (!isStarted) {
      this.gameEngine.startGame(gameId, gameData, mode);
      this.activityGateway.emitUserActivity(leftId);
      this.activityGateway.emitUserActivity(rightId);
    }
    gameInfo.isStarted = true;
    this.gameGateway.emitGameStarted({
      id: gameId,
      left: leftNickname,
      right: rightNickname,
    });
  }

  /**
   * @description 취소된 게임 삭제
   *
   * @param gameId 게임 id
   */
  deleteCancelledGame(gameId: GameId) {
    this.gameGateway.emitGameCancelled(gameId);
    this.gameStorage.deleteGame(gameId);
  }
}
