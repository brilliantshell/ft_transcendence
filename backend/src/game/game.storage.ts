import { DataSource, In } from 'typeorm';
import { DateTime } from 'luxon';
import { InjectDataSource } from '@nestjs/typeorm';
import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';

import { GameId, GameInfo, Score, UserId } from '../util/type';
import { MatchHistory } from '../entity/match-history.entity';
import { Users } from '../entity/users.entity';

@Injectable()
export class GameStorage {
  readonly players = new Map<UserId, GameId>();
  private readonly games = new Map<GameId, Required<GameInfo>>();
  private readonly usersInQueue = new Set<UserId>();
  matchedPair: UserId[] = [];
  private readonly logger = new Logger(GameStorage.name);

  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  /*****************************************************************************
   *                                                                           *
   * SECTION : Public Methods                                                  *
   *                                                                           *
   ****************************************************************************/

  /**
   * @description 게임 getter
   *
   * @param gameId 게임 id
   * @returns 게임 정보
   */
  getGame(gameId: GameId) {
    return this.games.get(gameId);
  }

  /**
   * @description 현재 진행중인 게임 목록 반환
   *
   * @returns 현재 진행중인 게임 목록
   */
  getGames() {
    return this.games;
  }

  /**
   * @description 게임 생성
   *
   * @param gameId 게임 id
   * @param gameInfo 게임 정보
   */
  async createGame(gameId: GameId, gameInfo: GameInfo) {
    const { leftId, rightId } = gameInfo;
    let players: Users[];
    try {
      players = await this.dataSource.manager.find(Users, {
        select: ['userId', 'nickname'],
        where: { userId: In([leftId, rightId]) },
      });
    } catch (e) {
      this.logger.error(e);
      throw new InternalServerErrorException(
        `Failed to create a normal game between the users, ${leftId} and ${rightId}`,
      );
    }
    const [{ nickname: leftNickname }, { nickname: rightNickname }] =
      players[0].userId === leftId ? players : [players[1], players[0]];
    gameInfo.leftNickname = leftNickname;
    gameInfo.rightNickname = rightNickname;
    this.games.set(gameId, gameInfo as Required<GameInfo>);
    this.players.set(gameInfo.leftId, gameId);
    this.players.set(gameInfo.rightId, gameId);
  }

  /**
   * @description 게임 종료 후 게임 결과 업데이트
   *
   * @param id 게임 id
   * @param scores 스코어
   * @param isRank ladder ? true : false
   */
  async updateResult(gameId: GameId, scores: [Score, Score]) {
    const { leftId, rightId, isRank } = this.getGame(gameId);
    this.deleteGame(gameId);
    const [winnerId, loserId] =
      scores[0] > scores[1] ? [leftId, rightId] : [rightId, leftId];
    const winnerPartialEntity = { winCount: () => 'win_count + 1' };
    const ladder = await this.calculateNewLadder(winnerId, loserId, scores);
    if (isRank) {
      winnerPartialEntity['ladder'] = ladder;
    }
    try {
      await this.dataSource.manager.transaction(async (manager) => {
        await manager.save(MatchHistory, {
          userOneId: leftId,
          userTwoId: rightId,
          userOneScore: scores[0],
          userTwoScore: scores[1],
          isRank,
          endAt: DateTime.now(),
        });
        await manager.update(Users, winnerId, winnerPartialEntity);
        await manager.update(Users, loserId, {
          lossCount: () => 'loss_count + 1',
        });
      });
    } catch (e) {
      this.logger.error(e);
      throw new InternalServerErrorException(
        `Failed to update the game result between ${leftId} and ${rightId}`,
      );
    }
    return isRank ? { winnerId, ladder } : null;
  }

  /**
   * @description ladder 게임 대기 큐에 유저가 있는지 확인
   *
   * @param userId 유저 id
   * @returns 유저가 대기 큐에 있는지 여부
   */
  isInLadderQueue(userId: UserId) {
    return this.usersInQueue.has(userId);
  }

  /**
   * @description ladder 게임 대기 큐에 유저 추가
   *
   * @param userId 유저 id
   */
  addUserToLadderQueue(userId: UserId) {
    this.usersInQueue.add(userId);
  }

  /**
   * @description ladder 게임 대기 큐에서 유저 삭제
   *
   * @param userId 유저 id
   * @returns 유저가 대기 큐에 있었는지 여부
   */
  deleteUserFromLadderQueue(userId: UserId) {
    return this.usersInQueue.delete(userId);
  }

  /*****************************************************************************
   *                                                                           *
   * SECTION : Private Methods                                                 *
   *                                                                           *
   ****************************************************************************/

  /**
   * @description 래더 점수 계산
   *
   * @param winnerId 승자 id
   * @param loserId 패자 id
   * @param scores 스코어
   * @returns 래더 점수
   */
  async calculateNewLadder(
    winnerId: UserId,
    loserId: UserId,
    scores: [Score, Score],
  ) {
    let beforeGame: Users[];
    try {
      beforeGame = await this.dataSource.manager.find(Users, {
        select: ['userId', 'ladder'],
        where: { userId: In([winnerId, loserId]) },
      });
    } catch (e) {
      this.logger.error(e);
      throw new InternalServerErrorException(
        `Failed to calculate ladder rise for the winner ${winnerId}`,
      );
    }
    const [winnerLadder, loserLadder] =
      beforeGame[0].userId === winnerId
        ? [beforeGame[0].ladder, beforeGame[1].ladder]
        : [beforeGame[1].ladder, beforeGame[0].ladder];
    const scoreGap = Math.abs(scores[0] - scores[1]);
    const ladderGap = Math.abs(winnerLadder - loserLadder);
    return (
      winnerLadder +
      (winnerLadder >= loserLadder
        ? Math.max(Math.floor(scoreGap * (1 - ladderGap / 42)), 1)
        : Math.floor(scoreGap * (1 + ladderGap / 42)))
    );
  }

  /**
   * @description 게임 삭제
   *
   * @param gameId 게임 id
   */
  deleteGame(gameId: GameId) {
    const gameInfo = this.getGame(gameId);
    if (gameInfo === undefined) {
      return;
    }
    const { leftId, rightId } = gameInfo;
    this.games.delete(gameId);
    this.players.delete(leftId);
    this.players.delete(rightId);
  }
}
