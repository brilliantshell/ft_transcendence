import { DataSource, MoreThan, Repository } from 'typeorm';
import { DateTime } from 'luxon';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';

import { AccessMode, Channels } from '../entity/channels.entity';
import { BannedMembers } from '../entity/banned-members.entity';
import {
  ChannelId,
  ChannelInfo,
  UserChannelStatus,
  UserId,
  UserRole,
} from '../util/type';
import { ChannelMembers } from '../entity/channel-members.entity';
import { Messages } from '../entity/messages.entity';
import { Users } from '../entity/users.entity';
import { UserRelationshipStorage } from './user-relationship.storage';

/**
 * 
 type UserId = number;
type ChannelId = number;
type UserRole = "owner" | "admin" | "member"

interface ChannelInfo {
	modifiedAt: timestamp;
	userRoleMap: Map<UserId, UserRole>;
	accessMode: "public" | "protected" | "private";
}

interface UserChannelStatus {
	unseenCount: number;
	muteEndAt: timestamp;
}

class ChannelStorage {
	private channels : Map<ChannelId, ChannelInfo>;
	private users : Map<UserId, Map<ChannelId, UserChannelStatus> >

	initChannels();
	loadUser(userId: UserId);
	unloadUser(userId: UserId);
	deleteUserFromChannel(channelId: ChannelId, userId, UserId);
	addChannel(ownerId: UserId, dmPeerId?: UserId): channelId;
	addUserToChannel(channelId: ChannelId, userId: UserId);
	getUserRole(channelId: ChannelId, userId: UserId): UserRole | null;
	updateUserRole(channelId: ChannelId, userId: UserId, role: UserRole);
	updateChannelModifiedAt(channelId: ChannelId, userId: userId);	
	updateMuteStatus(channelId: ChannelId, userId: userId, endTime: TIMESTAMP);
	updateUnseenCount(channelId: ChannelId, userId: userId, value: number);
	...
}
 */

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
  private usersRepository: Repository<Users>;
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
    this.usersRepository = this.dataSource.manager.getRepository(Users);
  }

  async onModuleInit() {
    await this.initChannels();
  }

  /*****************************************************************************
   *                                                                           *
   * SECTION : Public methods                                                  *
   *                                                                           *
   ****************************************************************************/

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
    let curUserRoleMap: Map<UserId, UserRole>;
    joinedMembers.forEach((member) => {
      const { channelId, channel, memberId, isAdmin } = member;
      const { accessMode, modifiedAt, ownerId } = channel;
      if (!this.channels.has(channelId)) {
        this.channels.set(channelId, {
          modifiedAt,
          userRoleMap: new Map<UserId, UserRole>(),
          accessMode,
        });
        curUserRoleMap = this.channels.get(channelId).userRoleMap;
      }
      curUserRoleMap.set(
        memberId,
        ownerId === memberId ? 'owner' : isAdmin ? 'admin' : 'member',
      );
    });
  }

  /**
   * @description 유저가 로그인 시 유저가 속한 채팅방과 유저 간 관계를 캐싱
   *
   * @param userId 로그인한 유저의 id
   */
  async loadUser(userId: UserId) {
    this.users.set(userId, new Map<ChannelId, UserChannelStatus>());
    try {
      const memberships = await this.channelMembersRepository.find({
        where: {
          memberId: userId,
        },
        select: {
          channelId: true,
          viewedAt: true as any,
          muteEndAt: true as any,
        },
      });
      const userMap = this.users.get(userId);
      await Promise.all(
        memberships.map(({ channelId, muteEndAt, viewedAt }) =>
          this.messagesRepository
            .countBy({
              channelId,
              createdAt: MoreThan(viewedAt),
            })
            .then((unseenCount) =>
              userMap.set(channelId, { unseenCount, muteEndAt }),
            ),
        ),
      );
    } catch (e) {
      console.error(e);
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

  /**
   * @description 유저-채팅방 캐시 맵 반환
   *
   * @param userId 유저의 id
   */
  getUser(userId: UserId) {
    return this.users.get(userId);
  }

  getChannel(channelId: ChannelId) {
    return this.channels.get(channelId);
  }

  // getUserRole(channelId: ChannelId, userId: UserId): UserRole | null {}

  /**
   * @description
   *
   */
  getChannels() {
    return this.channels;
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
        newChannel = insertResult.generatedMaps[0] as Channels;
        const { channelId, modifiedAt } = newChannel;
        dmCreatedAt = DateTime.fromJSDate(modifiedAt as unknown as Date);
        await manager.insert(ChannelMembers, [
          this.generateMemberInfo(channelId, owner, false, dmCreatedAt),
          this.generateMemberInfo(channelId, peer, false, dmCreatedAt),
        ]);
      });
      this.channels.set(newChannel.channelId, {
        modifiedAt: dmCreatedAt,
        userRoleMap: new Map<UserId, UserRole>()
          .set(owner, 'owner')
          .set(peer, 'member'),
        accessMode: 'private',
      });
      this.users.get(owner).set(newChannel.channelId, {
        unseenCount: 0,
        muteEndAt: DateTime.fromMillis(0),
      });
      this.users.get(peer)?.set(newChannel.channelId, {
        unseenCount: 0,
        muteEndAt: DateTime.fromMillis(0),
      });
      return newChannel.channelId;
    } catch (e) {
      this.logger.error(e);
      throw new InternalServerErrorException(`Failed to add DM channel`);
    }
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
    password = null,
  ): Promise<ChannelId> {
    try {
      let newChannel: Channels;
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
      this.channels.set(newChannel.channelId, {
        modifiedAt: newChannel.modifiedAt,
        userRoleMap: new Map<UserId, UserRole>().set(owner, 'owner'),
        accessMode: newChannel.accessMode,
      });
      this.users.get(owner).set(newChannel.channelId, {
        unseenCount: 0,
        muteEndAt: DateTime.fromMillis(0),
      });
      return newChannel.channelId;
    } catch (e) {
      console.error(e);
      this.logger.error(e);
      throw new InternalServerErrorException(`Failed to add channel`);
    }
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
      console.error(e);
      this.logger.error(e);
      throw new InternalServerErrorException(
        `Failed to add user(${userId}) to channel(${channelId})`,
      );
    }
    this.channels.get(channelId).userRoleMap.set(userId, 'member');
    this.users.get(userId)?.set(channelId, {
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
    try {
      const channelUsers = this.channels.get(channelId).userRoleMap;
      if (channelUsers.get(userId) === 'owner') {
        await this.channelsRepository.delete({ channelId });
        const members = channelUsers.keys();
        for (const member of members) {
          this.users.get(member)?.delete(channelId);
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
        this.users.get(userId)?.delete(channelId);
        channelUsers.delete(userId);
      }
    } catch (e) {
      this.logger.error(e);
      throw new InternalServerErrorException(
        `Failed to delete user(${userId}) from channel(${channelId})`,
      );
    }
  }

  /**
   * @description 채팅방에서 유저의 role 확인
   *
   * @param channelId 채팅방 id
   * @param userId 유저 id
   * @returns 유저의 role
   */
  getUserRole(channelId: ChannelId, userId: UserId) {
    return this.channels.get(channelId)?.userRoleMap.get(userId) ?? null;
  }

  /**
   * @description 채팅방에서 유저의 role 변경
   *
   * @param channelId 채팅방 id
   * @param memberId 유저 id
   * @param role 변경할 role
   */
  async updateUserRole(
    channelId: ChannelId,
    adminId: UserId,
    memberId: UserId,
    role: UserRole,
  ) {
    try {
      this.checkRole(
        channelId,
        adminId,
        memberId,
        `User(${adminId}) is not allowed to update user(${memberId})'s role`,
      );
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
    this.channels.get(channelId).userRoleMap.set(memberId, role);
  }

  /**
   * @description 채팅방이 마지막으로 변경된 시간 (메시지 송신 시간) 업데이트
   *
   * @param channelId 채팅방 id
   * @param userId 유저 id
   * @param modifiedAt 변경된 시간
   */
  async updateChannelModifiedAt(channelId: ChannelId, modifiedAt: DateTime) {
    try {
      await this.channelsRepository.update(channelId, { modifiedAt });
      this.channels.get(channelId).modifiedAt = modifiedAt;
    } catch (e) {
      this.logger.error(e);
      throw new InternalServerErrorException(
        `Failed to update channel(${channelId})'s modifiedAt`,
      );
    }
  }

  /**
   * @description 채팅방에서 유저의 mute 상태 업데이트
   *
   * @param channelId 채팅방 id
   * @param adminId 유저 id
   * @param memberId 유저 id
   * @param endTime mute 상태 해제 시간
   */
  async updateMuteStatus(
    channelId: ChannelId,
    adminId: UserId,
    memberId: UserId,
    endTime: DateTime,
  ) {
    try {
      this.checkRole(
        channelId,
        adminId,
        memberId,
        `User(${adminId}) is not allowed to update user(${memberId})'s mute status`,
      );
      if (endTime < DateTime.now()) {
        throw new BadRequestException(
          `Mute end time(${endTime.toISO()}) must be after now`,
        );
      }
      await this.channelMembersRepository.update(
        { channelId, memberId },
        { muteEndAt: endTime },
      );
      const userChannelStatus = this.getUser(memberId)?.get(channelId);
      if (userChannelStatus) {
        userChannelStatus.muteEndAt = endTime;
      }
    } catch (e) {
      this.logger.error(e);
      if (e instanceof ForbiddenException || e instanceof BadRequestException) {
        throw e;
      }
      throw new InternalServerErrorException(
        `Failed to update mute status of user(${memberId}) in channel(${channelId})`,
      );
    }
  }

  /**
   * @description
   */
  // async updateUnseenCount() {}

  /*****************************************************************************
   *                                                                           *
   * SECTION : Private methods                                                 *
   *                                                                           *
   ****************************************************************************/

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

  private checkRole(
    channelId: ChannelId,
    adminId: UserId,
    memberId: UserId,
    errorMessage: string,
  ) {
    const userRoles = { member: 0, admin: 1, owner: 2 };
    const adminRole = this.getUserRole(channelId, adminId);
    const memberRole = this.getUserRole(channelId, memberId);
    if (
      !adminRole ||
      !memberRole ||
      adminRole === 'member' ||
      userRoles[adminRole] <= userRoles[memberRole]
    ) {
      throw new ForbiddenException(errorMessage);
    }
  }
}
