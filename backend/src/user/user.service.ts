import { BlockedUsers } from './../entity/blocked-users.entity';
import { EntityNotFoundError, Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';

import { Activity, UserId } from '../util/type';
import { ActivityManager } from '../user-status/activity.manager';
import { ChannelStorage } from '../user-status/channel.storage';
import { UserGateway } from './user.gateway';
import { UserInfoDto } from './dto/user-gateway.dto';
import { UserProfileDto } from './dto/user.dto';
import { UserRelationshipStorage } from '../user-status/user-relationship.storage';
import { UserSocketStorage } from '../user-status/user-socket.storage';
import { Users } from '../entity/users.entity';

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);
  constructor(
    private readonly activityManager: ActivityManager,
    @InjectRepository(BlockedUsers)
    private readonly blockedUsersRepository: Repository<BlockedUsers>,
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

  /**
   * @description 유저의 닉네임과 프로필 이미지 경로를 반환 & userInfo 이벤트를 송신
   *
   *
   * @param requesterId 요청한 유저의 ID
   * @param requestedId 조회 대상 유저의 ID
   * @returns 유저의 닉네임과 프로필 이미지 경로
   */
  async findProfile(requesterId: UserId, targetId: UserId) {
    let profile: UserProfileDto;
    try {
      profile = await this.usersRepository.findOneOrFail({
        select: ['nickname', 'profileImage'],
        where: { userId: targetId },
      });
    } catch (e) {
      this.logger.error(e);
      throw e instanceof EntityNotFoundError
        ? new NotFoundException('User not found')
        : new InternalServerErrorException(
            'Failed to find nickname and profileImage of a user',
          );
    }
    const requesterSocketId = this.userSocketStorage.clients.get(targetId);
    if (requesterSocketId === undefined) {
      throw new InternalServerErrorException(
        'Failed to find socketId of a user',
      );
    }
    this.userGateway.emitUserInfo(
      requesterSocketId,
      this.createUserInfoDto(requesterId, targetId),
    );
    return profile;
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
   * SECTION : Game                                                            *
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
    const prevRelationship = this.userRelationshipStorage.getRelationship(
      blockerId,
      blockedId,
    );
    await this.userRelationshipStorage.blockUser(blockerId, blockedId);
    if (this.activityManager.getActivity(blockedId)) {
      const blockedSocketId = this.userSocketStorage.clients.get(blockedId);
      if (blockedSocketId === undefined) {
        throw new InternalServerErrorException(
          'Failed to find socketId of a user',
        );
      }
      this.userGateway.emitBlocked(blockedSocketId, blockerId);
    }
    return prevRelationship !== 'blocker';
  }

  /**
   * @description 유저를 차단 해제
   *
   * @param unblockerId 차단 해제자 id
   * @param unblockedId 차단 해제 될 유저 id
   */
  async deleteBlock(unblockerId: UserId, unblockedId: UserId) {
    await this.userRelationshipStorage.unblockUser(unblockerId, unblockedId);
    if (this.activityManager.getActivity(unblockedId)) {
      const unblockedSocketId = this.userSocketStorage.clients.get(unblockedId);
      if (unblockedSocketId === undefined) {
        throw new InternalServerErrorException(
          'Failed to find socketId of a user',
        );
      }
      this.userGateway.emitUnblocked(unblockedSocketId, unblockerId);
    }
  }

  /*****************************************************************************
   *                                                                           *
   * SECTION : Friend                                                          *
   *                                                                           *
   ****************************************************************************/

  /**
   * @description 유저를 친구 추가
   *
   * @param senderId 친구 추가 요청을 보낸 유저 id
   * @param receiverId 친구 추가 요청을 받을 유저 id
   * @returns 이미 친구 추가가 있다면 false, 아니라면 true
   */
  async createFriendRequest(senderId: UserId, receiverId: UserId) {
    const prevRelationship = this.userRelationshipStorage.getRelationship(
      senderId,
      receiverId,
    );
    if (['friend', 'pendingReceiver'].includes(prevRelationship)) {
      throw new ConflictException(
        prevRelationship === 'friend'
          ? 'Already friends'
          : 'Already received a friend request from the other user',
      );
    }
    await this.userRelationshipStorage.sendFriendRequest(senderId, receiverId);
    if (this.activityManager.getActivity(receiverId)) {
      const receiverSocketId = this.userSocketStorage.clients.get(receiverId);
      if (receiverSocketId === undefined) {
        throw new InternalServerErrorException(
          'Failed to find socketId of a user',
        );
      }
      this.userGateway.emitPendingFriendRequest(receiverSocketId, true);
    }
    return prevRelationship === null;
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
    //  TODO : throw NotFound (Guard 에서..?)
    await this.userRelationshipStorage.deleteFriendship(deleterId, deletedId);
    if (this.activityManager.getActivity(deletedId)) {
      const deletedSocketId = this.userSocketStorage.clients.get(deletedId);
      if (deletedSocketId === undefined) {
        throw new InternalServerErrorException(
          'Failed to find socketId of a user',
        );
      }
      switch (prevRelationship) {
        case 'friend':
          this.userGateway.emitFriendRemoved(deletedSocketId, deleterId);
        case 'pendingSender':
          this.userGateway.emitFriendCancelled(deletedSocketId, deleterId);
        case 'pendingReceiver':
          this.userGateway.emitFriendDeclined(deletedSocketId, deleterId);
        default:
      }
    }
  }

  /**
   * @description 친구 요청 수락
   *
   * @param accepterId 친구 요청울 수락하는 유저 id
   * @param acceptedId 친구 요청을 수락 당하는 유저 id
   */
  async acceptFriendRequest(accepterId: UserId, acceptedId: UserId) {
    const prevRelationship = this.userRelationshipStorage.getRelationship(
      accepterId,
      acceptedId,
    );
    if (['friend', 'pendingSender'].includes(prevRelationship)) {
      throw new ConflictException(
        prevRelationship === 'friend'
          ? 'Already friends'
          : 'Already received a friend request from the other user',
      );
    }
    await this.userRelationshipStorage.acceptFriendRequest(
      accepterId,
      acceptedId,
    );
    if (this.activityManager.getActivity(acceptedId)) {
      const acceptedSocketId = this.userSocketStorage.clients.get(acceptedId);
      if (acceptedSocketId === undefined) {
        throw new InternalServerErrorException(
          'Failed to find socketId of a user',
        );
      }
      this.userGateway.emitFriendAccepted(acceptedSocketId, accepterId);
    }
  }

  /*****************************************************************************
   *                                                                           *
   * SECTION : Private Methods                                                 *
   *                                                                           *
   ****************************************************************************/

  /**
   * @description 유저의 상태 정보를 담은 UserInfoDto 를 생성
   *
   * @param requesterId 요청하는 유저의 id
   * @param targetId 조회 대상 유저의 id
   * @returns
   */
  createUserInfoDto(requesterId: UserId, targetId: UserId): UserInfoDto {
    let activity: Activity = 'offline';
    const currentUi = this.activityManager.getActivity(targetId);
    if (currentUi) {
      activity = currentUi === 'playingGame' ? 'inGame' : 'online';
    }
    // TODO : 게임 중이라면 GameStorage 에서 gameId 가져오기
    const gameId = null;
    const relationship =
      this.userRelationshipStorage.getRelationship(requesterId, targetId) ??
      'normal';
    return {
      activity,
      gameId,
      relationship,
      userId: targetId,
    };
  }
}
