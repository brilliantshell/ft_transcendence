import { InjectRepository } from '@nestjs/typeorm';
import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { Repository } from 'typeorm';

import { Activity, UserId } from '../util/type';
import { ActivityManager } from '../user-status/activity.manager';
import { ChannelStorage } from '../user-status/channel.storage';
import { FriendListDto, UserProfileDto } from './dto/user.dto';
import { UserGateway } from './user.gateway';
import { UserActivityDto } from './dto/user-gateway.dto';
import { UserRelationshipStorage } from '../user-status/user-relationship.storage';
import { UserSocketStorage } from '../user-status/user-socket.storage';
import { Users } from '../entity/users.entity';

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);
  constructor(
    private readonly activityManager: ActivityManager,
    private readonly channelStorage: ChannelStorage,
    private readonly userGateway: UserGateway,
    private readonly userRelationshipStorage: UserRelationshipStorage,
    private readonly userSocketStorage: UserSocketStorage,
    @InjectRepository(Users)
    private readonly usersRepository: Repository<Users>,
  ) {}

  /*****************************************************************************
   *                                                                           *
   * SECTION : Public methods                                                  *
   *                                                                           *
   ****************************************************************************/

  /*****************************************************************************
   *                                                                           *
   * SECTION : Block                                                           *
   *                                                                           *
   ****************************************************************************/

  /**
   * @description 유저를 차단
   *
   * @param blockerId 차단자 id
   * @param blockedId 차단당할 유저 id
   * @returns 이미 차단한 유저라면 false, 아니라면 true
   */
  async createBlock(blockerId: UserId, blockedId: UserId) {
    if (
      this.userRelationshipStorage.getRelationship(blockerId, blockedId) ===
      'blocker'
    ) {
      return false;
    }
    await this.userRelationshipStorage.blockUser(blockerId, blockedId);
    const blockedSocketId = this.userSocketStorage.clients.get(blockedId);
    if (blockedSocketId !== undefined) {
      this.userGateway.emitUserRelationship(
        blockedSocketId,
        blockerId,
        'blocked',
      );
    }
    return true;
  }

  /**
   * @description 유저를 차단 해제
   *
   * @param unblockerId 차단 해제자 id
   * @param unblockedId 차단 해제 될 유저 id
   */
  async deleteBlock(unblockerId: UserId, unblockedId: UserId) {
    await this.userRelationshipStorage.unblockUser(unblockerId, unblockedId);
    const unblockedSocketId = this.userSocketStorage.clients.get(unblockedId);
    if (unblockedSocketId !== undefined) {
      this.userGateway.emitUserRelationship(
        unblockedSocketId,
        unblockerId,
        'normal',
      );
    }
  }

  /*****************************************************************************
   *                                                                           *
   * SECTION : DM                                                              *
   *                                                                           *
   ****************************************************************************/

  /**
   * @description DM 채널을 생성, 해당 채널의 id 및 신규 여부 반환
   *
   * @param ownerId DM 채널의 생성자 id
   * @param peerId DM 채널의 상대방 id
   * @returns DM 채널의 id 및 신규 여부
   */
  async createDm(ownerId: UserId, peerId: UserId) {
    const channels = this.channelStorage.getUser(ownerId);
    for (const [channelId] of channels) {
      if (
        this.userRelationshipStorage.isBlockedDm(channelId) !== undefined &&
        this.channelStorage.getChannel(channelId).userRoleMap.has(peerId)
      ) {
        return { dmId: channelId, isNew: false };
      }
    }
    return {
      dmId: await this.channelStorage.addDm(ownerId, peerId),
      isNew: true,
    };
  }

  /*****************************************************************************
   *                                                                           *
   * SECTION : Friend                                                          *
   *                                                                           *
   ****************************************************************************/

  /**
   * @description 유저의 친구 목록 반환
   *
   * @param userId 유저 id
   * @returns 친구 목록
   */
  findFriends(userId: UserId): FriendListDto {
    return { friends: this.userRelationshipStorage.getFriends(userId) };
  }

  /**
   * @description 유저를 친구 추가
   *
   * @param senderId 친구 추가 요청을 보낸 유저 id
   * @param receiverId 친구 추가 요청을 받을 유저 id
   * @returns 이미 친구 추가가 있다면 false, 아니라면 true
   */
  async createFriendRequest(senderId: UserId, receiverId: UserId) {
    if (
      this.userRelationshipStorage.getRelationship(senderId, receiverId) ===
      'pendingSender'
    ) {
      return false;
    }
    await this.userRelationshipStorage.sendFriendRequest(senderId, receiverId);
    const receiverSocketId = this.userSocketStorage.clients.get(receiverId);
    if (receiverSocketId !== undefined) {
      this.userGateway.emitFriendRequestDiff(receiverSocketId, 1);
      this.userGateway.emitUserRelationship(
        receiverSocketId,
        senderId,
        'pendingReceiver',
      );
    }
    return true;
  }

  /**
   * @description 친구 삭제, 친구 요청 거절, 친구 요청 취소
   *
   * @param deleterId 친구 관계 삭제 요청을 보낸 유저 id
   * @param deletedId 친구 관계 삭제 당할 유저 id
   */
  async deleteFriendship(deleterId: UserId, deletedId: UserId) {
    const prevRelationship = this.userRelationshipStorage.getRelationship(
      deleterId,
      deletedId,
    );
    await this.userRelationshipStorage.deleteFriendship(deleterId, deletedId);
    const deletedSocketId = this.userSocketStorage.clients.get(deletedId);
    if (deletedSocketId !== undefined) {
      if (prevRelationship === 'pendingSender') {
        this.userGateway.emitFriendRequestDiff(deletedSocketId, -1);
      }
      this.userGateway.emitUserRelationship(
        deletedSocketId,
        deleterId,
        'normal',
      );
    }
  }

  /**
   * @description 친구 요청 수락
   *
   * @param accepterId 친구 요청울 수락하는 유저 id
   * @param acceptedId 친구 요청을 수락 당하는 유저 id
   */
  async acceptFriendRequest(accepterId: UserId, acceptedId: UserId) {
    if (
      this.userRelationshipStorage.getRelationship(accepterId, acceptedId) ===
      'friend'
    ) {
      return;
    }
    await this.userRelationshipStorage.acceptFriendRequest(
      accepterId,
      acceptedId,
    );
    const acceptedSocketId = this.userSocketStorage.clients.get(acceptedId);
    if (acceptedSocketId !== undefined) {
      this.userGateway.emitUserRelationship(
        acceptedSocketId,
        accepterId,
        'friend',
      );
    }
  }

  // TODO
  /*****************************************************************************
   *                                                                           *
   * SECTION : Game                                                            *
   *                                                                           *
   ****************************************************************************/

  // createGame() {}

  // findGame(requesterId: UserId, peerId: UserId, gameId: GameId) {}

  /*****************************************************************************
   *                                                                           *
   * SECTION : UserProfile                                                     *
   *                                                                           *
   ****************************************************************************/

  /**
   * @description 유저의 닉네임과 프로필 이미지 경로를 반환 & userActivity & userRelationship 이벤트를 송신
   *
   *
   * @param requesterId 요청한 유저의 ID
   * @param requestedId 조회 대상 유저의 ID
   * @returns 유저의 닉네임과 프로필 이미지 경로
   */
  async findProfile(requesterId: UserId, targetId: UserId) {
    let profile: UserProfileDto;
    try {
      profile = await this.usersRepository.findOne({
        select: ['nickname', 'profileImage'],
        where: { userId: targetId },
      });
    } catch (e) {
      this.logger.error(e);
      throw new InternalServerErrorException(
        'Failed to find nickname and profileImage of a user',
      );
    }
    const requesterSocketId = this.userSocketStorage.clients.get(requesterId);
    if (requesterSocketId !== undefined) {
      this.userGateway.emitUserActivity(
        requesterSocketId,
        this.createUserActivityDto(targetId),
      );
      this.userGateway.emitUserRelationship(
        requesterSocketId,
        targetId,
        this.userRelationshipStorage.getRelationship(requesterId, targetId) ??
          'normal',
      );
    }
    return profile;
  }

  /*****************************************************************************
   *                                                                           *
   * SECTION : Private Methods                                                 *
   *                                                                           *
   ****************************************************************************/

  /**
   * @description 유저의 상태 정보를 담은 UserActivityDto 를 생성
   *
   * @param targetId 조회 대상 유저의 id
   * @returns
   */
  private createUserActivityDto(targetId: UserId): UserActivityDto {
    let activity: Activity = 'offline';
    const currentUi = this.activityManager.getActivity(targetId);
    if (currentUi) {
      activity = currentUi === 'playingGame' ? 'inGame' : 'online';
    }

    // TODO : 게임 중이라면 GameStorage 에서 gameId 가져오기
    const gameId = null;

    return {
      activity,
      gameId,
      userId: targetId,
    };
  }
}
