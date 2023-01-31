import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { hash, compare } from 'bcrypt';

import { AccessMode, Channels } from '../entity/channels.entity';
import { ActivityManager } from '../user-status/activity.manager';
import { AllChannelsDto, CreateChannelDto } from './dto/chats.dto';
import { ChannelStorage } from '../user-status/channel.storage';
import { ChannelId, UserChannelStatus, UserId } from '../util/type';
import { ChatsGateway } from './chats.gateway';
import { UserRelationshipStorage } from '../user-status/user-relationship.storage';
import { BannedMembers } from '../entity/banned-members.entity';
import { DateTime } from 'luxon';
import { Messages } from '../entity/messages.entity';

/*
[x]유저가 참여중인 채팅방 & 모든 PUBLIC, PROTECTED 채팅방 channels.modified_at 순으로 정렬 후 전달
[x]유저 인풋 기반으로 채팅방 생성
[x]유저를 채널에 추가 (protected 면 password 확인, 초대받았으면 바로 입장)
[x]채팅방 멤버 표시 및 관리
[]채팅방 메시지 송수신 및 표시
[]채팅방 멤버 권한 & 상태 (ban/mute) 관리
[]확인하지 않은 메시지 카운트
 */

@Injectable()
export class ChatsService {
  private readonly logger = new Logger(ChatsService.name);
  constructor(
    @InjectRepository(BannedMembers)
    private readonly bannedMembersRepository: Repository<BannedMembers>,
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
   * @param userId 요청한 유저의 Id
   * @returns 채널 목록
   */
  async findAllChannels(userId: UserId): Promise<AllChannelsDto> {
    const userChannelMap = this.channelStorage.getUser(userId);
    // NOTE: no channel in service
    if (this.channelStorage.getChannels().size === 0) {
      return { joinedChannels: [], otherChannels: [] };
    }
    if (!userChannelMap) {
      // NOTE : user does not loaded
      throw new BadRequestException('Invalid Request');
    }

    return {
      joinedChannels: await this.getJoinedChannels(userChannelMap),
      otherChannels: await this.getChannelsExceptJoined(userChannelMap),
    };
  }

  /**
   * @description 새로운 채널을 생성
   *
   * @param userId 요청한 유저의 Id
   * @param channel 새로 생성할 채널 정보
   * @returns 생성된 채널 Id
   */
  // NOTE : WS 이벤트 emit 해야 할 수 있음
  async createChannel(userId: UserId, channel: CreateChannelDto) {
    const { channelName, accessMode } = channel;
    const password = channel.password ?? null;

    if (
      (accessMode === 'protected' && !password) ||
      (accessMode !== 'protected' && password)
    ) {
      throw new BadRequestException('Password is required');
    }
    try {
      return await this.channelStorage.addChannel(
        accessMode as AccessMode,
        userId,
        channelName,
        accessMode === 'protected' ? await hash(password, 10) : null,
      );
    } catch (err) {
      throw err;
    }
  }

  /*****************************************************************************
   *                                                                           *
   * SECTION : chatRoom                                                        *
   *                                                                           *
   ****************************************************************************/

  /**
   * @description 채널의 멤버 목록 및 DM 차단 여부를 반환
   *
   * @param userId 요청한 유저의 Id
   * @param channelId 요청한 채널의 Id
   * @returns 채널의 멤버 목록 및 DM 차단 여부
   */
  findChannelMembers(userId: UserId, channelId: ChannelId) {
    const channelInfo = this.channelStorage.getChannel(channelId);
    if (channelInfo === undefined) {
      throw new NotFoundException('Channel not found');
    }
    if (!channelInfo.userRoleMap.has(userId)) {
      throw new ForbiddenException('You are not a member of this channel');
    }
    const channelMembers = Array.from(channelInfo.userRoleMap).map(
      ([userId, role]) => {
        return { id: userId, role };
      },
    );
    const dm = this.userRelationshipStorage.isBlockedDm(channelId);
    return { channelMembers, isReadonlyDm: dm === undefined ? null : dm };
  }

  /**
   * @description 유저가 채널에 입장
   *
   * @param userId 접속할 유저의 Id
   * @param channelId 접속할 채널 Id
   * @param isInvited 초대 여부
   * @param password? 비밀번호
   */
  async joinChannel(
    userId: UserId,
    channelId: ChannelId,
    isInvited: boolean,
    password: string = null,
  ) {
    const banEndAt = (
      await this.bannedMembersRepository.findOneBy({
        channelId,
        memberId: userId,
      })
    )?.endAt;
    if (banEndAt !== undefined && banEndAt > DateTime.now()) {
      throw new ForbiddenException('You are banned');
    }
    const accessMode = this.channelStorage.getChannel(channelId).accessMode;
    if (accessMode === 'public' || isInvited) {
      this.chatsGateway.emitMemberJoin(userId, channelId);
      return await this.channelStorage.addUserToChannel(channelId, userId);
    }
    if (accessMode === 'protected') {
      const channelPassword = (
        await this.channelsRepository.findOneBy({ channelId })
      ).password.toString();
      if (!password || !(await compare(password, channelPassword))) {
        throw new ForbiddenException('Password is incorrect');
      }
      this.chatsGateway.emitMemberJoin(userId, channelId);
      return await this.channelStorage.addUserToChannel(channelId, userId);
    }
    throw new ForbiddenException('Forbidden to join');
  }

  /**
   * @description 채널의 메시지를 최신순으로 begin부터 size만큼 반환
   *
   * @param userId 요청한 유저의 Id
   * @param channelId 요청한 채널의 Id
   * @param begin 시작 인덱스
   * @param size 반환할 메시지의 수
   * @returns
   */
  async findChannelMessages(
    userId: UserId,
    channelId: ChannelId,
    offset: number,
    size: number,
  ) {
    const channelInfo = this.channelStorage.getChannel(channelId);
    if (channelInfo === undefined) {
      throw new NotFoundException('Channel not found');
    }
    if (!channelInfo.userRoleMap.has(userId)) {
      throw new ForbiddenException('You are not a member of this channel');
    }
    try {
      const messages = (
        await this.messagesRepository.find({
          order: {
            createdAt: 'ASC' as any,
          },
          skip: offset,
          take: size,
          select: { senderId: true, contents: true, createdAt: true as any },
        })
      ).map((message) => {
        const { senderId, contents, createdAt } = message;
        return { senderId, contents, createdAt: createdAt.toMillis() };
      });
      return { messages };
    } catch (e) {
      this.logger.error(e);
      throw new InternalServerErrorException('Fail to get message');
    }
  }

  /*****************************************************************************
   *                                                                           *
   * SECTION : Private Methods                                                 *
   *                                                                           *
   ****************************************************************************/

  /**
   * @description 유저가 접속한 채널 목록을 반환
   *
   * @param userChannelMap 유저가 접속한 채널 목록
   * @returns 접속한 채널 목록
   */
  private async getJoinedChannels(
    userChannelMap: Map<ChannelId, UserChannelStatus>,
  ) {
    return await Promise.all(
      Array.from(userChannelMap)
        .sort(
          (a, b) =>
            this.channelStorage.getChannel(a[0]).modifiedAt.valueOf() -
            this.channelStorage.getChannel(b[0]).modifiedAt.valueOf(),
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
    ).catch((err) => {
      throw err;
    });
  }

  /**
   * @description 유저가 접속한 채널과 private 채널을 제외한 모든 채널 목록을 반환
   *
   * @param userChannelMap 유저가 접속한 채널 목록
   * @returns 접속한 채널과 private 채널을 제외한 모든 채널 목록
   */
  private async getChannelsExceptJoined(
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
      ).catch((err) => {
        throw err;
      })
    ).sort((a, b) => a.channelName.localeCompare(b.channelName));
  }
}
