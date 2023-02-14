import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { nanoid } from 'nanoid';

import { GameGateway } from './game.gateway';
import { GameId, GameInfo, UserId } from '../util/type';
import { GameStorage } from './game.storage';
import { UserRelationshipStorage } from '../user-status/user-relationship.storage';
import { UserSocketStorage } from '../user-status/user-socket.storage';

@Injectable()
export class GameService {
  constructor(
    private readonly gameGateway: GameGateway,
    private readonly gameStorage: GameStorage,
    private readonly userRelationshipStorage: UserRelationshipStorage,
    private readonly userSocketStorage: UserSocketStorage,
  ) {}

  /**
   * @description 현재 진행중인 ladder 게임 목록 반환
   *
   * @returns 현재 진행중인 게임 목록
   */
  findGames() {
    const games = [];
    this.gameStorage.getGames().forEach((gameInfo, gameId) => {
      games.push({
        id: gameId,
        left: gameInfo.leftNickname,
        right: gameInfo.rightNickname,
      });
    });
    return games.reverse();
  }

  /**
   * @description 관전을 요청하는 유저에게 게임의 기본 정보 제공 및 해당 게임 room 에 소켓 추가
   *
   * @param spectatorId 관전자 id
   * @param gameId 게임 id
   * @returns 게임의 기본 정보
   */
  findGameInfo(spectatorId: UserId, gameId: GameId) {
    const gameInfo = this.gameStorage.getGame(gameId);
    if (gameInfo === undefined) {
      throw new NotFoundException(
        `The game requested by ${spectatorId} does not exist`,
      );
    }
    const { leftId, leftNickname, rightId, rightNickname, map, isRank } =
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
    return { leftPlayer: leftNickname, rightPlayer: rightNickname, map };
  }

  // TODO : `game-${gameId}` ui 밖에서 요청하면 400 Guard 로 처리
  // TODO : interceptor 로 두 플레이어 모두 해당 요청에 응답 보냈을 때 게임 시작 event emit
  /**
   * @description 게임에 참여하는 유저에게 게임의 기본 정보 제공
   *
   * @param playerId 요청을 보낸 플레이어 id
   * @param gameId 게임 id
   * @returns 게임의 기본 정보
   */
  findPlayers(playerId: UserId, gameId: GameId) {
    const gameInfo = this.gameStorage.getGame(gameId);
    if (gameInfo === undefined) {
      throw new NotFoundException(
        `The game requested by ${playerId} does not exist`,
      );
    }
    if (gameInfo.leftId !== playerId && gameInfo.rightId !== playerId) {
      throw new ForbiddenException(
        `The requester(${playerId}) is not a participant of the game`,
      );
    }
    const { leftId, leftNickname, rightId, rightNickname } = gameInfo;
    const isLeft = gameInfo.leftId === playerId;
    const [playerNickname, opponentId, opponentNickname] = isLeft
      ? [leftNickname, rightId, rightNickname]
      : [rightNickname, leftId, leftNickname];
    return { isLeft, playerId, playerNickname, opponentId, opponentNickname };
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
      new GameInfo(inviterId, invitedId, 1, false),
    );
    this.gameGateway.joinRoom(
      this.userSocketStorage.clients.get(invitedId),
      `game-${gameId}`,
    );
    this.gameGateway.emitNewGame(gameId);
    this.gameGateway.joinRoom(
      this.userSocketStorage.clients.get(inviterId),
      `game-${gameId}`,
    );
    return gameId;
  }

  // TODO : `game-${gameId}` ui 밖에서 요청하면 400 Guard 로 처리
  /**
   * @description 게임 맵 변경
   *
   * @param requesterId 요청자 id
   * @param gameId 게임 id
   * @param map 변경할 맵
   */
  changeMap(requesterId: UserId, gameId: GameId, map: 1 | 2 | 3) {
    const gameInfo = this.gameStorage.getGame(gameId);
    if (gameInfo === undefined) {
      throw new NotFoundException(
        `The game(${gameId}) requested by ${requesterId} does not exist`,
      );
    }
    if (gameInfo.leftId !== requesterId && gameInfo.rightId !== requesterId) {
      throw new ForbiddenException(
        `The requester(${requesterId}) is not a participant of the game`,
      );
    }
    if (gameInfo.isRank) {
      throw new ForbiddenException(
        `The requester(${requesterId}) cannot change map of a ladder game`,
      );
    }
    if (gameInfo.leftId !== requesterId) {
      throw new ForbiddenException(
        `The invited player(${requesterId}) cannot change game options`,
      );
    }
    gameInfo.map = map;
    this.gameGateway.emitGameOption(
      this.userSocketStorage.clients.get(gameInfo.rightId),
      map,
    );
  }
}
