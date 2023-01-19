import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { BannedMembers } from '../entity/banned-members.entity';
import { ChannelMembers } from '../entity/channel-members.entity';
import { Channels } from '../entity/channels.entity';
import { Messages } from '../entity/messages.entity';
import { Users } from '../entity/users.entity';
import {
  ChannelId,
  ChannelInfo,
  UserChannelStatus,
  UserId,
  UserRole,
} from 'src/util/type';
import { In, MoreThan, Repository } from 'typeorm';

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
export class ChannelStorage {
  private channels: Map<ChannelId, ChannelInfo> = new Map<
    ChannelId,
    ChannelInfo
  >();
  private users: Map<UserId, Map<ChannelId, UserChannelStatus>> = new Map<
    UserId,
    Map<ChannelId, UserChannelStatus>
  >();

  private logger: Logger = new Logger(ChannelStorage.name);

  constructor(
    @InjectRepository(BannedMembers)
    private bannedMembersRepository: Repository<BannedMembers>,
    @InjectRepository(ChannelMembers)
    private channelMembersRepository: Repository<ChannelMembers>,
    @InjectRepository(Channels)
    private channelsRepository: Repository<Channels>,
    @InjectRepository(Messages)
    private messagesRepository: Repository<Messages>,
    @InjectRepository(Users)
    private usersRepository: Repository<Users>,
  ) {}

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
      await Promise.all(
        memberships.map(async ({ channel_id, viewed_at, mute_end_time }) => {
          return await this.messagesRepository
            .createQueryBuilder('message')
            .where(
              'message.channel_id = :channel_id AND message.created_at > :viewed_at',
              { channel_id, viewed_at },
            )
            .getCount()
            .then((count) => {
              this.users.get(userId).set(channel_id, {
                unseenCount: count,
                muteEndTime: mute_end_time,
              });
            });
        }),
      );
    } catch (e) {
      this.logger.error(e);
      throw new InternalServerErrorException(
        `Failed to load user-channel info of the user, ${userId}`,
      );
    }
  }

  getUser(userId: UserId) {
    return this.users.get(userId);
  }

  /**
   * @description
   *
   */
  getChannels() {
    return this.channels;
  }
}
