import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { DateTime } from 'luxon';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { hash, compare } from 'bcrypt';

import { AccessMode, Channels } from '../entity/channels.entity';
import { ActivityManager } from '../user-status/activity.manager';
import { AllChannelsDto, CreateChannelDto } from './dto/chats.dto';
import { BannedMembers } from '../entity/banned-members.entity';
import { ChannelStorage } from '../user-status/channel.storage';
import { ChannelId, UserChannelStatus, UserId } from '../util/type';
import { ChatsGateway } from './chats.gateway';
import { UserRelationshipStorage } from '../user-status/user-relationship.storage';
import { Messages } from '../entity/messages.entity';

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
   * SECTION : channel                                                         *
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
    const channelInfo = this.getValidChannelInfo(userId, channelId);
    const channelMembers = Array.from(channelInfo.userRoleMap).map(
      ([userId, role]) => {
        return { id: userId, role };
      },
    );
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
   */
  async joinChannel(
    userId: UserId,
    channelId: ChannelId,
    isInvited: boolean,
    password: string = null,
  ) {
    const banEndAt = await this.channelStorage.getBanEndAt(channelId, userId);
    if (banEndAt > DateTime.now()) {
      throw new ForbiddenException('You are banned');
    }
    const accessMode = this.channelStorage.getChannel(channelId).accessMode;
    if (accessMode === 'public' || isInvited) {
      await this.channelStorage.addUserToChannel(channelId, userId);
      return this.chatsGateway.emitMemberJoin(userId, channelId);
    }
    if (accessMode === 'protected') {
      const channelPassword = (
        await this.channelsRepository.findOneBy({ channelId })
      ).password.toString();
      if (!password || !(await compare(password, channelPassword))) {
        throw new ForbiddenException('Password is incorrect');
      }
      await this.channelStorage.addUserToChannel(channelId, userId);
      return this.chatsGateway.emitMemberJoin(userId, channelId);
    }
    throw new ForbiddenException('Forbidden to join');
  }

  /**
   * @description 유저가 채널에서 나감. 나갈시 채널에 이벤트 전송
   *
   * @param userId 나갈 유저의 Id
   * @param channelId 나갈 채널 Id
   * @returns
   */
  async leaveChannel(userId: UserId, channelId: ChannelId) {
    this.getValidChannelInfo(userId, channelId);
    await this.channelStorage.deleteUserFromChannel(channelId, userId);
    return this.chatsGateway.emitMemberLeft(
      userId,
      channelId,
      this.channelStorage.getUserRole(channelId, userId) === 'owner',
    );
  }

  /**
   * @description 채널의 메시지를 최신순으로 offset 부터 size만큼 반환
   *
   * @param userId 요청한 유저의 Id
   * @param channelId 요청한 채널의 Id
   * @param begin 시작 인덱스
   * @param size 반환할 메시지의 수
   * @returns 요청한 채널의 메시지 목록
   */
  // NOTE : offset, size 가 음수일 경우는 pipe 단계에서 걸러진다 가정
  async findChannelMessages(
    userId: UserId,
    channelId: ChannelId,
    offset: number,
    size: number,
  ) {
    this.getValidChannelInfo(userId, channelId);
    try {
      const messages = (
        await this.messagesRepository.find({
          order: {
            createdAt: 'ASC' as any,
          },
          skip: offset,
          take: size as any,
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

  /**
   * @description 채널에 메시지를 생성하거나 명령어를 실행
   *
   * @param senderId 메시지를 보낸 유저의 Id
   * @param channelId 메시지를 보낼 채널의 Id
   * @param contents 메시지 내용
   */
  // NOTE : message length 는 pipe 단계에서 걸러진다 가정
  async manageMessage(
    senderId: UserId,
    channelId: ChannelId,
    contents: string,
  ) {
    this.getValidChannelInfo(senderId, channelId);
    const now = DateTime.now();
    if (this.channelStorage.getUser(senderId).get(channelId).muteEndAt > now) {
      throw new ForbiddenException('You are muted');
    }
    if (contents.startsWith('/')) {
      return await this.executeCommand(senderId, channelId, contents);
    }
    await this.createMessage(senderId, channelId, contents, now);
  }

  /*****************************************************************************
   *                                                                           *
   * SECTION : Private Methods                                                 *
   *                                                                           *
   ****************************************************************************/

  /*****************************************************************************
   *                                                                           *
   * SECTION : param 유효성 검사                                               *
   *                                                                           *
   ****************************************************************************/

  /**
   * @description 유효한 채널 정보를 반환, 유효하지 않은 경우 exception
   *
   * @param userId 요청한 유저의 Id
   * @param channelId 요청한 채널의 Id
   * @returns 유효한 채널 정보
   */
  // FIXME: guard 나 pipe 로 할 수 있을지도
  private getValidChannelInfo(userId: UserId, channelId: ChannelId) {
    const channelInfo = this.channelStorage.getChannel(channelId);
    if (channelInfo === undefined) {
      throw new NotFoundException('Channel not found');
    }
    if (!channelInfo.userRoleMap.has(userId)) {
      throw new ForbiddenException('You are not a member of this channel');
    }
    return channelInfo;
  }

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

  /*****************************************************************************
   *                                                                           *
   * SECTION : Handling new message                                            *
   *                                                                           *
   ****************************************************************************/

  /**
   * @description 채널에 메시지를 생성
   *
   * @param senderId 메시지를 보낸 유저의 Id
   * @param channelId 메시지를 보낸 채널의 Id
   * @param contents 메시지 내용
   * @param createdAt 메시지 생성 시간
   */
  private async createMessage(
    senderId: UserId,
    channelId: ChannelId,
    contents: string,
    createdAt: DateTime,
  ) {
    try {
      await this.messagesRepository.insert({
        senderId,
        channelId,
        contents,
        createdAt,
      });
    } catch (e) {
      this.logger.error(e);
      throw new InternalServerErrorException('Fail to create message');
    }
    this.chatsGateway.emitNewMessage(senderId, channelId, contents, createdAt);
    for (const id of this.channelStorage
      .getChannel(channelId)
      .userRoleMap.keys()) {
      const currentUi = this.activityManager.getActivity(id);
      if (currentUi !== null && currentUi !== `chatRooms-${channelId}`) {
        this.channelStorage.updateUnseenCount(channelId, id);
      }
    }
  }

  /**
   * @description 메시지로 명령어가 들어왔을 때 명령어를 실행
   *
   * @param senderId 명령을 보낸 유저의 Id
   * @param channelId 명령을 보낸 채널의 Id
   * @param contents 명령 내용
   */
  // NOTE:  { message : "/command [targetId] [time]|[role]" } 와 같은 형식으로 명령어가 온다고 가정
  private async executeCommand(
    senderId: UserId,
    channelId: ChannelId,
    contents: string,
  ) {
    if (
      /^\/((role \d{5,6} (admin|member))|((ban|mute) \d{5,6} \d{1,4}))$/.test(
        contents,
      ) === false
    ) {
      // TODO: format 안맞으면 에러를 던질지 메시지로 쏴줄지 생각해보기
      // TODO: 정규식 패턴 검증을 밖에서 할지 생각해보기
      throw new BadRequestException('Invalid command');
    }
    const [command, id, arg] = contents.split(' ');
    const targetId = Number(id);
    if (this.channelStorage.getUserRole(channelId, targetId) === null) {
      throw new NotFoundException(
        'Target member is not a member of this channel',
      );
    }
    switch (command) {
      case '/role': {
        const role = arg as 'admin' | 'member';
        await this.channelStorage.updateUserRole(
          channelId,
          senderId,
          targetId,
          role,
        );
        return this.chatsGateway.emitRoleChanged(targetId, channelId, role);
      }
      case '/mute': {
        const minutes = DateTime.now().plus({ minutes: Number(arg) });
        await this.channelStorage.updateMuteStatus(
          channelId,
          senderId,
          targetId,
          minutes,
        );
        return this.chatsGateway.emitMuted(targetId, channelId, minutes);
      }
      case '/ban': {
        const minutes = DateTime.now().plus({ minutes: Number(arg) });
        await this.channelStorage.banUser(
          channelId,
          senderId,
          targetId,
          minutes,
        );
        return this.chatsGateway.emitMemberLeft(targetId, channelId, false);
      }
      default:
        throw new BadRequestException('Invalid command');
    }
  }
}
