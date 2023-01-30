import { ChannelStorage } from './../user-status/channel.storage';
import { UserSocketStorage } from './../user-status/user-socket.storage';
import { UserRelationshipStorage } from './../user-status/user-relationship.storage';
import { ActivityManager } from './../user-status/activity.manager';
import { UserGateway } from './user.gateway';
import { UserProfileDto } from './dto/user.dto';
import { UserInfoDto } from './dto/user-gateway.dto';
import { UserId, Activity } from './../util/type';
import { Users } from './../entity/users.entity';
import { InjectRepository } from '@nestjs/typeorm';
import {
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { EntityNotFoundError, Repository } from 'typeorm';

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);
  constructor(
    @InjectRepository(Users)
    private readonly usersRepository: Repository<Users>,
    private readonly userRelationshipStorage: UserRelationshipStorage,
    private readonly userGateway: UserGateway,
    private readonly userSocketStorage: UserSocketStorage,
    private readonly activityManager: ActivityManager,
    private readonly channelStorage: ChannelStorage,
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

  createUserInfoDto(requesterId: UserId, requestedId: UserId): UserInfoDto {
    let activity: Activity = 'offline';
    const currentUi = this.activityManager.getActivity(requestedId);
    if (currentUi) {
      activity = currentUi === 'playingGame' ? 'inGame' : 'online';
    }
    // TODO : 게임 중이라면 GameStorage 에서 gameId 가져오기
    const gameId = null;
    const relationship =
      this.userRelationshipStorage.getRelationship(requesterId, requestedId) ??
      'normal';
    return {
      activity,
      gameId,
      relationship,
      userId: requestedId,
    };
  }
}
