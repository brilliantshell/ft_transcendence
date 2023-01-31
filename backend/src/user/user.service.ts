import { EntityNotFoundError, Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import {
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';

import { ActivityManager } from '../user-status/activity.manager';
import { ChannelStorage } from '../user-status/channel.storage';
import { UserGateway } from './user.gateway';
import { Activity, UserId } from '../util/type';
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
    private readonly channelStorage: ChannelStorage,
    @InjectRepository(Users)
    private readonly userGateway: UserGateway,
    private readonly userRelationshipStorage: UserRelationshipStorage,
    private readonly userSocketStorage: UserSocketStorage,
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
    if (!requesterSocketId) {
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
  /*****************************************************************************
   *                                                                           *
   * SECTION : Friend                                                          *
   *                                                                           *
   ****************************************************************************/
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
