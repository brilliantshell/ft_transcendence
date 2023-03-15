import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { DataSource, EntityManager, MoreThan, Repository } from 'typeorm';
import { DateTime } from 'luxon';
import { InjectDataSource } from '@nestjs/typeorm';

import { AccessMode, Channels } from '../entity/channels.entity';
import { BannedMembers } from '../entity/banned-members.entity';
import {
  ChannelId,
  ChannelInfo,
  MessageId,
  UserChannelStatus,
  UserId,
  UserRole,
} from '../util/type';
import { ChannelMembers } from '../entity/channel-members.entity';
import { Messages } from '../entity/messages.entity';
import { UserRelationshipStorage } from './user-relationship.storage';

@Injectable()
export class ChannelStorage implements OnModuleInit {
  private channels: Map<ChannelId, ChannelInfo> = new Map<
    ChannelId,
    ChannelInfo
  >();
  private users: Map<UserId, Map<ChannelId, UserChannelStatus>> = new Map<
    UserId,
    Map<ChannelId, UserChannelStatus>
  >();

  private bannedMembersRepository: Repository<BannedMembers>;
  private channelMembersRepository: Repository<ChannelMembers>;
  private channelsRepository: Repository<Channels>;
  private messagesRepository: Repository<Messages>;
  private logger: Logger = new Logger(ChannelStorage.name);

  constructor(
    @InjectDataSource()
    private dataSource: DataSource,
    private userRelationshipStorage: UserRelationshipStorage,
  ) {
    this.bannedMembersRepository =
      this.dataSource.manager.getRepository(BannedMembers);
    this.channelMembersRepository =
      this.dataSource.manager.getRepository(ChannelMembers);
    this.channelsRepository = this.dataSource.manager.getRepository(Channels);
    this.messagesRepository = this.dataSource.manager.getRepository(Messages);
  }

  /*****************************************************************************
   *                                                                           *
   * SECTION : Public methods                                                  *
   *                                                                           *
   ****************************************************************************/

  /*****************************************************************************
   *                                                                           *
   * SECTION : Channels set up & tear down                                     *
   *                                                                           *
   ****************************************************************************/

  /**
   * @description dependency resolution 시 initChannels() 호출
   *
   */
  async onModuleInit() {
    await this.initChannels();
  }

  /**
   * @description App bootstrap 시 채팅방들의 정보를 캐싱
   *
   */
  async initChannels() {
    let joinedMembers: ChannelMembers[];
    try {
      joinedMembers = await this.channelMembersRepository.find({
        relations: ['channel'],
        select: {
          channel: {
            accessMode: true,
            modifiedAt: true as any,
            ownerId: true,
          },
          channelId: true,
          isAdmin: true,
          memberId: true,
        },
        order: { channelId: 'ASC' },
      });
    } catch (e) {
      this.logger.error(e);
      throw new InternalServerErrorException(`Failed to load channels' info`);
    }
    this.setChannels(joinedMembers);
  }

  /*****************************************************************************
   *                                                                           *
   * SECTION : User-to-channel set up & tear down                              *
   *                                                                           *
   ****************************************************************************/

  /**
   * @description 유저가 로그인 시 유저가 속한 채팅방과 유저 간 관계를 캐싱
   *
   * @param userId 로그인한 유저의 id
   */
  async loadUser(userId: UserId) {
    this.users.set(userId, new Map<ChannelId, UserChannelStatus>());
    try {
      const memberships = await this.channelMembersRepository.find({
        where: { memberId: userId },
        select: {
          channelId: true,
          viewedAt: true as any,
          muteEndAt: true as any,
        },
      });
      await Promise.all(
        memberships.map(({ channelId, muteEndAt, viewedAt }) =>
          this.messagesRepository
            .countBy({ channelId, createdAt: MoreThan(viewedAt) })
            .then((unseenCount) =>
              this.getUser(userId)?.set(channelId, { unseenCount, muteEndAt }),
            ),
        ),
      );
    } catch (e) {
      this.logger.error(e);
      throw new InternalServerErrorException(
        `Failed to load user-channel info of the user, ${userId}`,
      );
    }
  }

  /**
   * @description 유저가 서비스를 떠날 시 캐시 삭제
   *
   * @param userId 떠난 유저의 id
   */
  unloadUser(userId: UserId) {
    this.users.delete(userId);
  }

  /*****************************************************************************
   *                                                                           *
   * SECTION : Channels management                                             *
   *                                                                           *
   ****************************************************************************/

  /**
   * @description 채팅방 캐시 맵 반환
   *
   */
  getChannel(channelId: ChannelId) {
    return this.channels.get(channelId);
  }

  /**
   * @description DM 채널 생성
   *
   * @param owner DM을 생성한 유저의 id
   * @param peer DM을 생성한 유저의 상대방 id
   * @returns 생성된 DM 채널의 id
   */
  async addDm(owner: UserId, peer: UserId) {
    let newChannel: Channels;
    let dmCreatedAt: DateTime;
    try {
      await this.dataSource.manager.transaction(async (manager) => {
        const result = await this.executeAddDmTransaction(manager, owner, peer);
        newChannel = result.newChannel;
        dmCreatedAt = result.dmCreatedAt;
      });
    } catch (e) {
      this.logger.error(e);
      throw new InternalServerErrorException(`Failed to add DM channel`);
    }
    this.channels.set(newChannel.channelId, {
      modifiedAt: dmCreatedAt,
      userRoleMap: new Map<UserId, UserRole>()
        .set(owner, 'owner')
        .set(peer, 'member'),
      accessMode: 'private',
    });
    this.getUser(owner).set(newChannel.channelId, {
      unseenCount: 0,
      muteEndAt: DateTime.fromMillis(0),
    });
    this.getUser(peer)?.set(newChannel.channelId, {
      unseenCount: 0,
      muteEndAt: DateTime.fromMillis(0),
    });
    this.userRelationshipStorage.addDm(newChannel.channelId);
    return newChannel.channelId;
  }

  /**
   * @description 채팅방 생성
   *
   * @param accessMode 채팅방 접근 권한
   * @param owner 채팅방 생성자
   * @param name 채팅방 이름
   * @param password 채팅방 비밀번호
   * @returns 생성된 채팅방의 id
   */
  async addChannel(
    accessMode: AccessMode,
    owner: UserId,
    name: string,
    password: string,
  ): Promise<ChannelId> {
    let newChannel: Channels;
    try {
      await this.dataSource.manager.transaction(async (manager) => {
        newChannel = await manager.save(Channels, {
          accessMode,
          modifiedAt: DateTime.now(),
          name,
          ownerId: owner,
          password,
        });
        const { channelId, modifiedAt } = newChannel;
        await manager.insert(
          ChannelMembers,
          this.generateMemberInfo(channelId, owner, true, modifiedAt),
        );
      });
    } catch (e) {
      this.logger.error(e);
      throw new InternalServerErrorException(`Failed to add channel`);
    }
    this.channels.set(newChannel.channelId, {
      modifiedAt: newChannel.modifiedAt,
      userRoleMap: new Map<UserId, UserRole>().set(owner, 'owner'),
      accessMode: newChannel.accessMode,
    });
    this.getUser(owner).set(newChannel.channelId, {
      unseenCount: 0,
      muteEndAt: DateTime.fromMillis(0),
    });
    return newChannel.channelId;
  }

  /**
   * @description 채팅방 정보 수정
   *
   * @param channelId 채팅방 id
   * @param accessMode 채팅방 접근 권한
   * @param password 채팅방 비밀번호
   */
  async updateChannel(
    channelId: ChannelId,
    accessMode: AccessMode,
    password: string | null = null,
  ) {
    try {
      this.channelsRepository.update(channelId, {
        accessMode,
        password,
      });
    } catch (e) {
      this.logger.error(e);
      throw new InternalServerErrorException(`Failed to update channel`);
    }
    this.getChannel(channelId).accessMode = accessMode;
  }

  /**
   * @description 채팅방에 유저 추가
   *
   * @param channelId 채팅방 id
   * @param userId 유저 id
   */
  async addUserToChannel(channelId: ChannelId, userId: UserId) {
    try {
      await this.dataSource.manager.transaction(async (manager) => {
        await manager.save(ChannelMembers, {
          channelId,
          memberId: userId,
          muteEndAt: 'epoch',
          viewedAt: DateTime.now(),
        });
        await manager.update(
          Channels,
          { channelId },
          { modifiedAt: DateTime.now(), memberCount: () => 'member_count + 1' },
        );
      });
    } catch (e) {
      this.logger.error(e);
      throw new InternalServerErrorException(
        `Failed to add user(${userId}) to channel(${channelId})`,
      );
    }
    this.getChannel(channelId).userRoleMap.set(userId, 'member');
    this.getUser(userId)?.set(channelId, {
      unseenCount: 0,
      muteEndAt: DateTime.fromMillis(0),
    });
  }

  /**
   * @description 채팅방에서 유저 삭제
   *
   * @param channelId 채팅방 id
   * @param userId 유저 id
   *
   */
  async deleteUserFromChannel(channelId: ChannelId, userId: UserId) {
    const channelUsers = this.getChannel(channelId).userRoleMap;
    try {
      if (channelUsers.get(userId) === 'owner') {
        await this.channelsRepository.delete({ channelId });
        const members = channelUsers.keys();
        for (const member of members) {
          this.getUser(member)?.delete(channelId);
        }
        this.channels.delete(channelId);
      } else {
        await this.dataSource.manager.transaction(async (manager) => {
          await manager.delete(ChannelMembers, {
            channelId,
            memberId: userId,
          });
          await manager.update(
            Channels,
            { channelId },
            {
              modifiedAt: DateTime.now(),
              memberCount: () => 'member_count - 1',
            },
          );
        });
      }
    } catch (e) {
      this.logger.error(e);
      throw new InternalServerErrorException(
        `Failed to delete user(${userId}) from channel(${channelId})`,
      );
    }
    this.getUser(userId)?.delete(channelId);
    channelUsers.delete(userId);
  }

  /**
   * @description 채팅방이 마지막으로 변경된 시간 (메시지 송신 시간) 업데이트
   *
   * @param channelId 채팅방 id
   * @param userId 유저 id
   * @param modifiedAt 변경된 시간
   */
  async updateChannelMessage(
    channelId: ChannelId,
    senderId: UserId,
    contents: string,
    modifiedAt: DateTime,
  ) {
    let messageId: MessageId;
    try {
      await this.dataSource.manager.transaction(async (manager) => {
        await manager.update(Channels, channelId, { modifiedAt });
        messageId = (
          await manager.insert(Messages, {
            senderId,
            channelId,
            contents,
            createdAt: modifiedAt,
          })
        ).identifiers[0].messageId;
      });
    } catch (e) {
      this.logger.error(e);
      throw new InternalServerErrorException(
        `Failed to update channel(${channelId})'s modifiedAt`,
      );
    }
    this.getChannel(channelId).modifiedAt = modifiedAt;
    return messageId;
  }

  /*****************************************************************************
   *                                                                           *
   * SECTION : User in channel                                                 *
   *                                                                           *
   ****************************************************************************/

  /**
   * @description 유저-채팅방 캐시 맵 반환
   *
   * @param userId 유저의 id
   */
  getUser(userId: UserId) {
    return this.users.get(userId);
  }

  /**
   * @description 채팅방에서 유저의 role 확인
   *
   * @param channelId 채팅방 id
   * @param userId 유저 id
   * @returns 유저의 role
   */
  getUserRole(channelId: ChannelId, userId: UserId) {
    return this.getChannel(channelId)?.userRoleMap.get(userId) ?? null;
  }

  /**
   * @description 채팅방에서 유저의 role 변경
   *
   * @param channelId 채팅방 id
   * @param memberId 유저 id
   * @param role 변경할 role
   */
  async updateUserRole(channelId: ChannelId, memberId: UserId, role: UserRole) {
    try {
      await this.channelMembersRepository.update(
        { channelId, memberId },
        { isAdmin: role === 'admin' },
      );
    } catch (e) {
      this.logger.error(e);
      if (e instanceof ForbiddenException) {
        throw e;
      }
      throw new InternalServerErrorException(
        `Failed to update user(${memberId})'s role in channel(${channelId})`,
      );
    }
    this.getChannel(channelId).userRoleMap.set(memberId, role);
  }

  /**
   * @description 채팅방에서 유저의 mute 상태 업데이트
   *
   * @param channelId 채팅방 id
   * @param memberId 유저 id
   * @param endTime mute 상태 해제 시간
   */
  async updateMuteStatus(
    channelId: ChannelId,
    memberId: UserId,
    endAt: DateTime,
  ) {
    try {
      await this.channelMembersRepository.update(
        { channelId, memberId },
        { muteEndAt: endAt },
      );
    } catch (e) {
      this.logger.error(e);
      if (e instanceof ForbiddenException || e instanceof BadRequestException) {
        throw e;
      }
      throw new InternalServerErrorException(
        `Failed to update mute status of user(${memberId}) in channel(${channelId})`,
      );
    }
    const userChannelStatus = this.getUser(memberId)?.get(channelId);
    if (userChannelStatus) {
      userChannelStatus.muteEndAt = endAt;
    }
  }

  /**
   * @description 읽지 않은 메시지 수 업데이트
   *
   * @param channelId 채팅방 id
   * @param userId 유저 id
   * @param isReset 읽지 않은 메시지 수를 0으로 초기화할지 여부
   */
  async updateUnseenCount(
    channelId: ChannelId,
    userId: UserId,
    isReset = false,
  ) {
    const userChannelStatus = this.getUser(userId)?.get(channelId);
    if (userChannelStatus) {
      if (isReset) {
        await this.channelMembersRepository.update(
          { channelId, memberId: userId },
          { viewedAt: DateTime.now() },
        );
      }
      userChannelStatus.unseenCount = isReset
        ? 0
        : userChannelStatus.unseenCount + 1;
    }
  }

  /*****************************************************************************
   *                                                                           *
   * SECTION : Ban                                                             *
   *                                                                           *
   ****************************************************************************/

  /**
   * @description 해당 유저가 채팅방에서 추방 상태 해제되는 시점 반환
   *
   * @param channelId 채팅방 id
   * @param memberId 유저 id
   * @returns 추방 상태 해제 시점
   */
  async getBanEndAt(channelId: ChannelId, memberId: UserId) {
    try {
      return (
        (
          await this.bannedMembersRepository.findOneBy({
            channelId,
            memberId,
            endAt: MoreThan(DateTime.now()),
          })
        )?.endAt ?? DateTime.fromMillis(0)
      );
    } catch (e) {
      this.logger.error(e);
      throw new InternalServerErrorException(
        `Failed to get ban end time of user(${memberId}) in channel(${channelId})`,
      );
    }
  }

  /**
   * @description 채팅방에서 유저를 추방
   *
   * @param channelId 채팅방 id
   * @param adminId 관리자 유저 id
   * @param memberId 유저 id
   * @param banEndAt 추방 상태 해제 시간
   */
  async banUser(channelId: ChannelId, memberId: UserId, banEndAt: DateTime) {
    try {
      await this.dataSource.manager.transaction(async (manager) => {
        await manager.save(BannedMembers, {
          channelId,
          memberId,
          endAt: banEndAt,
        });
        await this.deleteUserFromChannel(channelId, memberId);
      });
    } catch (e) {
      this.logger.error(e);
      if (e instanceof ForbiddenException || e instanceof BadRequestException) {
        throw e;
      }
      throw new InternalServerErrorException(
        `Failed to ban user(${memberId}) in channel(${channelId})`,
      );
    }
  }

  /*****************************************************************************
   *                                                                           *
   * NOTE : TEST ONLY                                                          *
   *                                                                           *
   ****************************************************************************/

  getChannels() {
    return this.channels;
  }

  /*****************************************************************************
   *                                                                           *
   * SECTION : Private methods                                                 *
   *                                                                           *
   ****************************************************************************/

  /**
   * @description 채팅방 멤버 정보를 채널 정보에 반영
   *
   * @param joinedMembers 채팅방 멤버 정보
   */
  private setChannels(joinedMembers: ChannelMembers[]) {
    let curUserRoleMap: Map<UserId, UserRole>;
    joinedMembers.forEach((member) => {
      const { channelId, channel, memberId, isAdmin } = member;
      const { accessMode, modifiedAt, ownerId } = channel;
      if (!this.channels.has(channelId)) {
        this.channels.set(channelId, {
          accessMode,
          modifiedAt,
          userRoleMap: new Map<UserId, UserRole>(),
        });
        curUserRoleMap = this.getChannel(channelId).userRoleMap;
      }
      curUserRoleMap.set(
        memberId,
        ownerId === memberId ? 'owner' : isAdmin ? 'admin' : 'member',
      );
    });
  }

  /**
   * @description 채팅방 멤버 정보 생성
   *
   * @param channelId 채팅방 id
   * @param memberId 멤버 id
   * @param isAdmin 관리자 여부
   * @param viewedAt 채팅방 생성 시간
   * @returns 채팅방 멤버 정보
   */
  private generateMemberInfo(
    channelId: ChannelId,
    memberId: UserId,
    isAdmin: boolean,
    viewedAt: DateTime,
  ) {
    return { channelId, isAdmin, muteEndAt: 'epoch', viewedAt, memberId };
  }

  /**
   * @description DM 채널을 DB 에 저장
   *
   * @param manager DB manager
   * @param owner DM 생성자
   * @param peer DM 상대
   * @returns 생성된 DM 채널 정보
   */
  private async executeAddDmTransaction(
    manager: EntityManager,
    owner: UserId,
    peer: UserId,
  ) {
    const insertResult = await manager
      .createQueryBuilder()
      .insert()
      .into(Channels)
      .values({
        accessMode: 'private' as AccessMode,
        memberCount: 2,
        modifiedAt: DateTime.now(),
        name: () =>
          "(SELECT string_agg(nickname, ', ' ORDER BY \
          ARRAY_POSITION(ARRAY[:owner::int, :peer::int], user_id)) \
          FROM users WHERE user_id IN (:owner, :peer))",
        ownerId: owner,
        dmPeerId: peer,
      })
      .setParameters({ owner, peer })
      .returning(['channelId', 'modifiedAt'])
      .execute();
    const newChannel = insertResult.generatedMaps[0] as Channels;
    const { channelId, modifiedAt } = newChannel;
    const dmCreatedAt = DateTime.fromJSDate(modifiedAt as unknown as Date);
    await manager.insert(ChannelMembers, [
      this.generateMemberInfo(channelId, owner, false, dmCreatedAt),
      this.generateMemberInfo(channelId, peer, false, dmCreatedAt),
    ]);
    return { newChannel, dmCreatedAt };
  }
}
