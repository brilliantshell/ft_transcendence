import { DataSource, MoreThan, Repository } from 'typeorm';
import { DateTime } from 'luxon';
import {
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
type UserRole = "owner" | "admin" | "normal"

interface ChannelInfo {
	modifiedAt: timestamp;
	userRoleMap: Map<UserId, UserRole>;
	accessMode: "public" | "protected" | "private";
}

interface UserChannelStatus {
	unseenCount: number;
	muteEndTime: timestamp;
}

class ChannelStorage {
	private channels : Map<ChannelId, ChannelInfo>;
	private users : Map<UserId, Map<ChannelId, UserChannelStatus> >

	initChannels();
	loadUser(userId: UserId);
	unloadUser(userId: UserId);
	getUserRole(channelId: ChannelId, userId: UserId): UserRole | null;
	deleteUserFromChannel(channelId: ChannelId, userId, UserId);
	addChannel(ownerId: UserId, dmPeerId?: UserId): channelId;
	addUserToChannel(channelId: ChannelId, userId: UserId);
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
            access_mode: true,
            modified_at: true as any,
            owner_id: true,
          },
          channel_id: true,
          is_admin: true,
          member_id: true,
        },
        order: { channel_id: 'ASC' },
      });
    } catch (e) {
      this.logger.error(e);
      throw new InternalServerErrorException(`Failed to load channels' info`);
    }
    let curUserRoleMap: Map<UserId, UserRole>;
    joinedMembers.forEach((member) => {
      const { channel_id, channel, member_id, is_admin } = member;
      const { access_mode, modified_at, owner_id } = channel;
      if (!this.channels.has(channel_id)) {
        this.channels.set(channel_id, {
          modifiedAt: modified_at,
          userRoleMap: new Map<UserId, UserRole>(),
          accessMode: access_mode,
        });
        curUserRoleMap = this.channels.get(channel_id).userRoleMap;
      }
      curUserRoleMap.set(
        member_id,
        owner_id === member_id ? 'owner' : is_admin ? 'admin' : 'normal',
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
        relations: ['channel'],
        where: {
          member_id: userId,
        },
        select: {
          channel_id: true,
          viewed_at: true as any,
          mute_end_time: true as any,
          channel: { modified_at: true as any },
        },
      });
      const userMap = this.users.get(userId);
      await Promise.all(
        memberships.map(
          async ({ channel_id, mute_end_time, viewed_at }) =>
            await this.messagesRepository
              .countBy({ channel_id, created_at: MoreThan(viewed_at) })
              .then((unseenCount) =>
                userMap.set(channel_id, {
                  unseenCount,
                  muteEndTime: mute_end_time,
                }),
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

  async addDm(owner: UserId, peer: UserId) {
    let newChannel: Channels;
    let dmCreatedAt: DateTime;
    try {
      const subQuery = () =>
        "(SELECT string_agg(nickname, ', ' ORDER BY \
        ARRAY_POSITION(ARRAY[:owner::int, :peer::int], user_id)) \
        FROM users WHERE user_id IN (:owner, :peer))";
      await this.dataSource.manager.transaction(async (manager) => {
        const insertResult = await manager
          .createQueryBuilder()
          .insert()
          .into(Channels)
          .values({
            access_mode: 'private' as AccessMode,
            member_cnt: 2,
            modified_at: DateTime.now(),
            name: subQuery,
            owner_id: owner,
            dm_peer_id: peer,
          })
          .setParameters({ owner, peer })
          .returning(['channel_id', 'modified_at'])
          .execute();
        newChannel = insertResult.generatedMaps[0] as Channels;
        const { channel_id, modified_at } = newChannel;
        dmCreatedAt = DateTime.fromJSDate(modified_at as unknown as Date);
        await manager.insert(ChannelMembers, [
          this.generateMemberInfo(channel_id, owner, false, dmCreatedAt),
          this.generateMemberInfo(channel_id, peer, false, dmCreatedAt),
        ]);
      });
      this.channels.set(newChannel.channel_id, {
        modifiedAt: dmCreatedAt,
        userRoleMap: new Map<UserId, UserRole>()
          .set(owner, 'owner')
          .set(peer, 'normal'),
        accessMode: 'private',
      });
      this.users.get(owner).set(newChannel.channel_id, {
        unseenCount: 0,
        muteEndTime: DateTime.fromMillis(0),
      });
      this.users.get(peer)?.set(newChannel.channel_id, {
        unseenCount: 0,
        muteEndTime: DateTime.fromMillis(0),
      });
      return newChannel.channel_id;
    } catch (e) {
      this.logger.error(e);
      throw new InternalServerErrorException(`Failed to add DM channel`);
    }
  }

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
          access_mode: accessMode,
          modified_at: DateTime.now(),
          name,
          owner_id: owner,
          password,
        });
        const { channel_id, modified_at } = newChannel;
        await manager.insert(
          ChannelMembers,
          this.generateMemberInfo(channel_id, owner, true, modified_at),
        );
      });
      this.channels.set(newChannel.channel_id, {
        modifiedAt: newChannel.modified_at,
        userRoleMap: new Map<UserId, UserRole>().set(owner, 'owner'),
        accessMode: newChannel.access_mode,
      });
      this.users.get(owner).set(newChannel.channel_id, {
        unseenCount: 0,
        muteEndTime: DateTime.fromMillis(0),
      });
      return newChannel.channel_id;
    } catch (e) {
      console.error(e);
      this.logger.error(e);
      throw new InternalServerErrorException(`Failed to add channel`);
    }
  }

  async addUserToChannel(channelId: ChannelId, userId: UserId) {
    try {
      await this.dataSource.manager.transaction(async (manager) => {
        await manager.save(ChannelMembers, {
          channel_id: channelId,
          member_id: userId,
          mute_end_time: 'epoch',
          viewed_at: DateTime.now(),
        });
        await manager.update(
          Channels,
          { channel_id: channelId },
          { modified_at: DateTime.now(), member_cnt: () => 'member_cnt + 1' },
        );
      });
    } catch (e) {
      this.logger.error(e);
      throw new InternalServerErrorException(
        `Failed to add user(${userId}) to channel(${channelId})`,
      );
    }
    this.channels.get(channelId).userRoleMap.set(userId, 'normal');
    this.users.get(userId)?.set(channelId, {
      unseenCount: 0,
      muteEndTime: DateTime.fromMillis(0),
    });
  }

  async deleteUserFromChannel(channelId: ChannelId, userId: UserId) {
    try {
      const channelUsers = this.channels.get(channelId).userRoleMap;
      if (channelUsers.get(userId) === 'owner') {
        await this.channelsRepository.delete({ channel_id: channelId });
        const members = channelUsers.keys();
        for (const member of members) {
          this.users.get(member)?.delete(channelId);
        }
        this.channels.delete(channelId);
      } else {
        await this.dataSource.manager.transaction(async (manager) => {
          await manager.delete(ChannelMembers, {
            channel_id: channelId,
            member_id: userId,
          });
          await manager.update(
            Channels,
            { channel_id: channelId },
            { modified_at: DateTime.now(), member_cnt: () => 'member_cnt - 1' },
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

  generateMemberInfo(
    channelId: ChannelId,
    memberId: UserId,
    isAdmin: boolean,
    createdAt: DateTime,
  ) {
    return {
      channel_id: channelId,
      is_admin: isAdmin,
      mute_end_time: 'epoch',
      viewed_at: createdAt,
      member_id: memberId,
    };
  }
}
