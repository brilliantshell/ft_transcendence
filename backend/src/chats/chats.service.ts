import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { DateTime } from 'luxon';
import { EntityNotFoundError, Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { compare } from 'bcrypt';

import { AccessMode, Channels } from '../entity/channels.entity';
import { ActivityManager } from '../user-status/activity.manager';
import {
  AllChannelsDto,
  CreateChannelDto,
  UpdateChannelDto,
} from './dto/chats.dto';
import { ChannelStorage } from '../user-status/channel.storage';
import { ChannelId, UserChannelStatus, UserId, UserRole } from '../util/type';
import { ChatsGateway } from './chats.gateway';
import { Messages } from '../entity/messages.entity';
import { UserRelationshipStorage } from '../user-status/user-relationship.storage';

@Injectable()
export class ChatsService {
  private readonly logger = new Logger(ChatsService.name);

  constructor(
    private readonly activityManager: ActivityManager,
    private readonly channelStorage: ChannelStorage,
    @InjectRepository(Channels)
    private readonly channelsRepository: Repository<Channels>,
    private readonly chatsGateway: ChatsGateway,
    @InjectRepository(Messages)
    private readonly messagesRepository: Repository<Messages>,
    private readonly userRelationshipStorage: UserRelationshipStorage,
  ) {}

  /*****************************************************************************
   *                                                                           *
   * SECTION : Public Methods                                                  *
   *                                                                           *
   ****************************************************************************/

  /*****************************************************************************
   *                                                                           *
   * SECTION : chats                                                           *
   *                                                                           *
   ****************************************************************************/

  /**
   * @description 유저가 접속한 채널 목록 및 private 이 아닌 모든 채널 목록을 반환
   *              접속한 채널 목록은 modifiedAt 순으로 정렬, 나머지는 알파벳 순으로 정렬
   *
   * @param userId 요청한 유저의 Id
   * @returns 채널 목록
   */
  async findAllChannels(userId: UserId): Promise<AllChannelsDto> {
    if (this.channelStorage.getChannels().size === 0) {
      return { joinedChannels: [], otherChannels: [] };
    }
    // FIXME : Delete when AuthGuard is implemented
    const userChannelMap = this.channelStorage.getUser(userId);
    if (!userChannelMap) {
      throw new BadRequestException('Invalid Request');
    }
    return {
      joinedChannels: await this.getJoinedChannels(userId, userChannelMap),
      otherChannels: await this.getChannelsExceptJoined(userId, userChannelMap),
    };
  }

  /**
   * @description 새로운 채널을 생성 및 chats-UI 에 이벤트 전송
   *               생성한 유저는 자동으로 채널에 참여
   *
   * @param userId 요청한 유저의 Id
   * @param channel 새로 생성할 채널 정보
   * @returns 생성된 채널 Id
   */
  async createChannel(userId: UserId, channel: CreateChannelDto) {
    const { channelName, accessMode, password } = channel;

    const channelId = await this.channelStorage.addChannel(
      accessMode as AccessMode,
      userId,
      channelName,
      password,
    );
    if (accessMode !== 'private') {
      this.chatsGateway.emitChannelCreated(channelId, channelName, accessMode);
    }
    this.chatsGateway.joinChannelRoom(channelId, userId);
    return channelId;
  }

  async updateChannel(channelId: ChannelId, channel: UpdateChannelDto) {
    const { accessMode, password } = channel;
    const channelInfo = this.channelStorage.getChannel(channelId);
    const prevAccessMode = channelInfo.accessMode;

    await this.channelStorage.updateChannel(
      channelId,
      accessMode as AccessMode,
      password,
    );
    if (prevAccessMode === 'private' && accessMode !== 'private') {
      let name: string;
      try {
        name = (
          await this.channelsRepository.findOneOrFail({
            where: { channelId },
            select: ['name'],
          })
        ).name;
      } catch (e) {
        this.logger.error(e);
        throw e instanceof EntityNotFoundError
          ? new NotFoundException('Channel not found')
          : new InternalServerErrorException('Failed to get channel name');
      }
      this.chatsGateway.emitChannelShown(
        channelId,
        name,
        accessMode,
        channelInfo.userRoleMap.size,
      );
    } else if (prevAccessMode !== 'private' && accessMode === 'private') {
      this.chatsGateway.emitChannelHidden(channelId);
    }
    this.chatsGateway.emitChannelUpdated(channelId, 0, accessMode);
  }

  /*****************************************************************************
   *                                                                           *
   * SECTION : Join & Leave channel                                            *
   *                                                                           *
   ****************************************************************************/

  /**
   * @description 채널의 멤버 목록 및 DM 차단 여부를 반환
   *
   * @param channelId 요청한 채널의 Id
   * @returns 채널의 멤버 목록 및 DM 차단 여부
   */
  findChannelMembers(channelId: ChannelId) {
    const { userRoleMap } = this.channelStorage.getChannel(channelId);
    const channelMembers: Array<{ id: UserId; role: UserRole }> = [];
    for (const [userId, role] of userRoleMap) {
      channelMembers.push({ id: userId, role });
    }
    const dm = this.userRelationshipStorage.isBlockedDm(channelId);
    return { channelMembers, isReadonlyDm: dm === undefined ? null : dm };
  }

  /**
   * @description 유저가 채널에 입장. 입장시 채널에 이벤트 전송
   *
   * @param userId 접속할 유저의 Id
   * @param channelId 접속할 채널 Id
   * @param isInvited 초대 여부
   * @param password 비밀번호 (protected 채널일 경우)
   * @returns 이미 채널에 접속한 경우 false, 접속에 성공한 경우 true
   */
  async joinChannel(
    channelId: ChannelId,
    userId: UserId,
    isInvited: boolean,
    password: string = null,
  ) {
    if (this.channelStorage.getUserRole(channelId, userId) !== null) {
      this.channelStorage.updateUnseenCount(channelId, userId, true);
      return false;
    }
    const { accessMode } = this.channelStorage.getChannel(channelId);
    if (accessMode === 'public' || isInvited) {
      await this.channelStorage.addUserToChannel(channelId, userId);
      this.chatsGateway.emitMemberJoin(channelId, userId);
      this.chatsGateway.emitChannelInvited(channelId, userId);
      return true;
    }
    if (accessMode === 'protected') {
      let channelPassword: string;
      try {
        channelPassword = (
          await this.channelsRepository.findOneBy({ channelId })
        ).password.toString();
      } catch (e) {
        this.logger.error(e);
        throw new InternalServerErrorException(
          `Failed to get channel(${channelId}) password`,
        );
      }
      if (!password || !(await compare(password, channelPassword))) {
        throw new ForbiddenException('Password is incorrect');
      }
      await this.channelStorage.addUserToChannel(channelId, userId);
      this.chatsGateway.emitMemberJoin(channelId, userId);
      return true;
    }
    throw new ForbiddenException('Forbidden to join');
  }

  /**
   * @description 유저가 채널에서 나감. 나갈시 채널에 이벤트 전송
   *
   * @param channelId 나갈 채널 Id
   * @param userId 나갈 유저의 Id
   */
  async leaveChannel(channelId: ChannelId, userId: UserId) {
    const isOwner =
      this.channelStorage.getUserRole(channelId, userId) === 'owner';
    await this.channelStorage.deleteUserFromChannel(channelId, userId);
    return this.chatsGateway.emitMemberLeft(channelId, userId, isOwner);
  }

  /**
   * @description 채널의 메시지를 최신순으로 offset 부터 limit만큼 반환
   *
   * @param channelId 요청한 채널의 Id
   * @param offset 시작 인덱스
   * @param limit 반환할 메시지의 최대 개수
   * @returns 요청한 채널의 메시지 목록
   */
  async findChannelMessages(
    channelId: ChannelId,
    offset: number,
    limit: number,
  ) {
    try {
      const messages = (
        await this.messagesRepository.find({
          where: { channelId },
          order: { createdAt: 'DESC' as any },
          skip: offset,
          take: limit,
          select: ['messageId', 'senderId', 'contents', 'createdAt'],
        })
      ).map((message) => {
        const { messageId, senderId, contents, createdAt } = message;
        return {
          senderId,
          messageId,
          contents,
          createdAt: createdAt.toMillis(),
        };
      });
      return { messages };
    } catch (e) {
      this.logger.error(e);
      throw new InternalServerErrorException('Fail to get message');
    }
  }

  /*****************************************************************************
   *                                                                           *
   * SECTION : Handling new message                                            *
   *                                                                           *
   ****************************************************************************/

  /**
   * @description 채널에 메시지를 생성 및 채널에 이벤트 전송
   *
   * @param senderId 메시지를 보낸 유저의 Id
   * @param channelId 메시지를 보낸 채널의 Id
   * @param contents 메시지 내용
   */
  async createMessage(
    channelId: ChannelId,
    senderId: UserId,
    contents: string,
  ) {
    let messageId: number;
    const createdAt = DateTime.now();
    try {
      messageId = await this.channelStorage.updateChannelMessage(
        channelId,
        senderId,
        contents,
        createdAt,
      );
    } catch (e) {
      this.logger.error(e);
      throw new InternalServerErrorException('Failed to create message');
    }
    this.chatsGateway.emitNewMessage(
      channelId,
      senderId,
      messageId,
      contents,
      createdAt,
    );
    this.channelStorage.getChannel(channelId).userRoleMap.forEach((v, id) => {
      const currentUi = this.activityManager.getActivity(id);
      if (currentUi !== null && currentUi !== `chatRooms-${channelId}`) {
        this.channelStorage.updateUnseenCount(channelId, id);
      }
    });
  }

  /**
   * @description 메시지로 명령어가 들어왔을 때 명령어를 실행 및 채널에 이벤트 전송
   *
   * @param senderId 명령을 보낸 유저의 Id
   * @param channelId 명령을 보낸 채널의 Id
   * @param contents 명령 내용
   */
  async executeCommand(
    channelId: ChannelId,
    senderId: UserId,
    command: [string, number, string?],
  ) {
    const [kind, targetId, arg] = command;
    if (this.channelStorage.getUserRole(channelId, targetId) === null) {
      throw new NotFoundException(
        'Target member is not a member of this channel',
      );
    }
    this.checkRole(channelId, senderId, targetId);
    const now = DateTime.now();
    if (kind === 'role') {
      const role = arg as 'admin' | 'member';
      await this.channelStorage.updateUserRole(channelId, targetId, role);
      return this.chatsGateway.emitRoleChanged(channelId, targetId, role);
    } else if (kind === 'mute') {
      const minutes = now.plus({ minutes: Number(arg) });
      await this.channelStorage.updateMuteStatus(channelId, targetId, minutes);
      return this.chatsGateway.emitMuted(channelId, targetId, minutes);
    } else {
      const minutes = arg
        ? now.plus({ minutes: Number(arg) })
        : now.plus({ years: 142 });
      await this.channelStorage.banUser(channelId, targetId, minutes);
      this.chatsGateway.emitMemberLeft(channelId, targetId, false);
      return this.chatsGateway.emitBanned(channelId, targetId);
    }
  }

  /*****************************************************************************
   *                                                                           *
   * SECTION : Private Methods                                                 *
   *                                                                           *
   ****************************************************************************/

  /*****************************************************************************
   *                                                                           *
   * SECTION : Find and sort channel list data                                 *
   *                                                                           *
   ****************************************************************************/

  /**
   * @description 유저가 접속한 채널 목록을 반환
   *
   * @param userChannelMap 유저가 접속한 채널 목록
   * @returns 접속한 채널 목록
   */
  private async getJoinedChannels(
    userId: UserId,
    userChannelMap: Map<ChannelId, UserChannelStatus>,
  ) {
    return await Promise.all(
      Array.from(userChannelMap)
        .sort(
          (a, b) =>
            this.channelStorage.getChannel(b[0]).modifiedAt.valueOf() -
            this.channelStorage.getChannel(a[0]).modifiedAt.valueOf(),
        )
        .map(async (channel) => {
          const channelId = channel[0];
          const userChannelStatus = channel[1];
          const channelInfo = this.channelStorage.getChannel(channelId);
          const channelName = (
            await this.channelsRepository.findOne({
              where: { channelId },
              select: { name: true },
            })
          ).name;
          return {
            channelId,
            channelName,
            memberCount: channelInfo.userRoleMap.size,
            accessMode: channelInfo.accessMode,
            unseenCount: userChannelStatus.unseenCount,
            isDm:
              this.userRelationshipStorage.isBlockedDm(channelId) !== undefined,
          };
        }),
    ).catch((e) => {
      this.logger.error(e);
      throw new InternalServerErrorException(
        `Failed to get joined channels for user (id: ${userId})`,
      );
    });
  }

  /**
   * @description 유저가 접속한 채널과 private 채널을 제외한 모든 채널 목록을 반환
   *
   * @param userChannelMap 유저가 접속한 채널 목록
   * @returns 접속한 채널과 private 채널을 제외한 모든 채널 목록
   */
  private async getChannelsExceptJoined(
    userId: UserId,
    userChannelMap: Map<ChannelId, UserChannelStatus>,
  ) {
    return (
      await Promise.all(
        Array.from(this.channelStorage.getChannels())
          .filter(
            (channel) =>
              !userChannelMap.has(channel[0]) &&
              channel[1].accessMode !== 'private',
          )
          .map(async (otherChannel) => {
            const channelId = otherChannel[0];
            const channel = otherChannel[1];
            const channelName = (
              await this.channelsRepository.findOne({
                where: { channelId },
                select: { name: true },
              })
            ).name;
            return {
              channelId,
              channelName,
              memberCount: channel.userRoleMap.size,
              accessMode: channel.accessMode as 'public' | 'protected',
            };
          }),
      ).catch((e) => {
        this.logger.error(e);
        throw new InternalServerErrorException(
          `Fail to get channels except joined for user (id: ${userId})`,
        );
      })
    ).sort((a, b) =>
      new Intl.Collator('ko').compare(a.channelName, b.channelName),
    );
  }

  /*****************************************************************************
   *                                                                           *
   * SECTION : Check permission to execute command                             *
   *                                                                           *
   *****************************************************************************/

  private checkRole(channelId: ChannelId, senderId: UserId, targetId: UserId) {
    const userRoles = { member: 0, admin: 1, owner: 2 };
    const senderRole = this.channelStorage.getUserRole(channelId, senderId);
    const targetRole = this.channelStorage.getUserRole(channelId, targetId);
    if (
      !senderRole ||
      !targetRole ||
      senderRole === 'member' ||
      userRoles[senderRole] <= userRoles[targetRole] ||
      this.userRelationshipStorage.isBlockedDm(channelId) !== undefined
    ) {
      throw new ForbiddenException(`You don't have permission to do this`);
    }
  }
}
