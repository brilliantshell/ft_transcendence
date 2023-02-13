import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';

import { GameId, UserId } from '../util/type';
import { GameGateway } from './game.gateway';
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
   * @description 관전을 요청하는 유저에게 게임의 기본 정보 제공 및 해당 게임 room 에 소켓 추가
   *
   * @param spectatorId 관전자 id
   * @param gameId 게임 id
   * @returns 게임의 기본 정보
   */
  findGameInfo(spectatorId: UserId, gameId: GameId) {
    const gameInfo = this.gameStorage.games.get(gameId);
    if (gameInfo === undefined) {
      throw new NotFoundException(
        `The game requested by ${spectatorId} does not exist`,
      );
    }
    const { leftId, leftNickname, rightId, rightNickname, map } = gameInfo;
    if (
      this.userRelationshipStorage
        .getRelationship(spectatorId, leftId)
        ?.startsWith('block') ||
      this.userRelationshipStorage
        .getRelationship(spectatorId, rightId)
        ?.startsWith('block')
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
}
