import { InjectRepository } from '@nestjs/typeorm';
import {
  Injectable,
  InternalServerErrorException,
  ForbiddenException,
  Logger,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { nanoid } from 'nanoid';

import { GameId, GameInfo, UserId } from '../util/type';
import { GameGateway } from './game.gateway';
import { GameStorage } from './game.storage';
import { UserRelationshipStorage } from '../user-status/user-relationship.storage';
import { UserSocketStorage } from '../user-status/user-socket.storage';
import { Users } from './../entity/users.entity';
import { In, Repository } from 'typeorm';

@Injectable()
export class GameService {
  private readonly logger: Logger;

  constructor(
    private readonly gameGateway: GameGateway,
    private readonly gameStorage: GameStorage,
    private readonly userRelationshipStorage: UserRelationshipStorage,
    @InjectRepository(Users)
    private readonly usersRepository: Repository<Users>,
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
    if (
      !isRank &&
      (this.userRelationshipStorage
        .getRelationship(spectatorId, leftId)
        ?.startsWith('block') ||
        this.userRelationshipStorage
          .getRelationship(spectatorId, rightId)
          ?.startsWith('block'))
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

  // NOTE : UserModule 의 Guard 가 block 확인
  /**
   * @description 일반 게임 생성
   *
   * @param inviterId 게임 초대자 id
   * @param invitedId 게임 초대받은 id
   * @returns 생성된 게임의 id
   */
  async createNormalGame(inviterId: UserId, invitedId: UserId) {
    // FIXME : Guard 로 분리
    if (this.gameStorage.players.has(inviterId)) {
      throw new BadRequestException(
        `The inviter(${inviterId}) is already in a game`,
      );
    }
    if (this.gameStorage.players.has(invitedId)) {
      throw new ConflictException(
        `The inviter(${inviterId}) is already in a game`,
      );
    }
    let players: Users[];
    try {
      players = await this.usersRepository.find({
        select: ['userId', 'nickname'],
        where: { userId: In([inviterId, invitedId]) },
      });
    } catch (e) {
      this.logger.error(e);
      throw new InternalServerErrorException(
        `Failed to create a normal game between the users, ${inviterId} and ${invitedId}`,
      );
    }
    const gameId = nanoid();
    const [inviter, invited] =
      players[0].userId === inviterId ? players : [players[1], players[0]];
    this.gameStorage.createGame(
      gameId,
      new GameInfo(inviter, invited, 1, false),
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
    if (!this.gameStorage.players.has(requesterId)) {
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
