import {
  Body,
  Controller,
  Delete,
  Get,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';

import { ChatsService } from './chats.service';
import {
  ControlMessageDto,
  CreateChannelDto,
  JoinChannelDto,
} from './dto/chats.dto';
import { MockAuthGuard } from './guard/mock-auth.guard';
import { Response } from 'express';
import { VerifiedRequest } from '../util/type';
import { ValidateNewChannelPipe } from './pipe/validate-new-channel.pipe';
import { ChannelExistGuard } from './guard/channel-exist.guard';
import { MemberExistGuard } from './guard/member-exist.guard';
import { JoinChannelGuard } from './guard/join-channel.guard';
import { ValidateRangePipe } from './pipe/validate-range.pipe';
import { MemberMessagingGuard } from './member-messaging/member-messaging.guard';

/**
[x] 존재하지 않는 channelId 로 요청시 404 응답하는 Guard 구현
[x] 채널의 member 가 요청을 보내야 하는 상황에서 userId 의 유저가 멤버가 아닐 시 403 응답하는 Guard 구현
[x] 채널 입장 시 userId 유저의 Ban 여부 검증하여 403 응답하는 Guard 구현
[x] 채널 입장 시 userId 유저가 이미 채널 멤버인 경우 409 응답하는 Guard 혹은 Pipe 구현
[x] 채널 메시지를 GET 하는 요청 시 query string 으로 오는 range 의 유효성을 검증하는 pipe 구현
[x] 채널에 메시지 전송한 유저가 Mute 상태일 시 403 응답하는 Guard 구현
[] 채널에 메시지 전송 시 message 인지 command 인지 구분하여 데이터를 변환해주는 pipe 혹은 interceptor 구현
 */

@UseGuards(MockAuthGuard)
@Controller('chats')
export class ChatsController {
  constructor(private readonly chatsService: ChatsService) {}

  /*****************************************************************************
   *                                                                           *
   * SECTION : chats                                                           *
   *                                                                           *
   ****************************************************************************/

  @Get()
  findAllChannels(@Req() req: VerifiedRequest) {
    return this.chatsService.findAllChannels(req.user.userId);
  }

  @Post()
  async createChannel(
    @Req() req: VerifiedRequest,
    @Body(ValidateNewChannelPipe) createChannelDto: CreateChannelDto,
    @Res() res: Response,
  ) {
    res
      .set(
        'location',
        `/chats/${await this.chatsService.createChannel(
          req.user.userId,
          createChannelDto,
        )}`,
      )
      .status(HttpStatus.CREATED)
      .end();
  }

  /*****************************************************************************
   *                                                                           *
   * SECTION : Join & Leave channel                                            *
   *                                                                           *
   ****************************************************************************/

  @Get(':channelId')
  @UseGuards(ChannelExistGuard, MemberExistGuard)
  findChannelMembers(@Param('channelId', ParseIntPipe) channelId: number) {
    return this.chatsService.findChannelMembers(channelId);
  }

  @Post(':channelId/user/:userId')
  @UseGuards(ChannelExistGuard, JoinChannelGuard)
  joinChannel(
    @Req() req: VerifiedRequest,
    @Param('channelId', ParseIntPipe) channelId: number,
    @Param('userId', ParseIntPipe) userId: number,
    @Body() joinChannelDto: JoinChannelDto,
  ) {
    return this.chatsService.joinChannel(
      channelId,
      req.user.userId,
      userId !== req.user.userId,
      joinChannelDto.password || null,
    );
  }

  @Delete(':channelId/user')
  @UseGuards(ChannelExistGuard, MemberExistGuard)
  leaveChannel(
    @Req() req: VerifiedRequest,
    @Param('channelId', ParseIntPipe) channelId: number,
  ) {
    return this.chatsService.leaveChannel(channelId, req.user.userId);
  }

  /*****************************************************************************
   *                                                                           *
   * SECTION : Messages                                                        *
   *                                                                           *
   ****************************************************************************/

  @Get(':channelId/message')
  @UseGuards(ChannelExistGuard, MemberExistGuard)
  findChannelMessages(
    @Param('channelId', ParseIntPipe) channelId: number,
    @Query('range', ValidateRangePipe)
    range: [offset: number, limit: number],
  ) {
    return this.chatsService.findChannelMessages(channelId, range[0], range[1]);
  }

  @Post(':channelId/message')
  @UseGuards(ChannelExistGuard, MemberExistGuard, MemberMessagingGuard)
  controlMessage(
    @Req() req: /* VerifiedRequest */ any,
    @Param('channelId', ParseIntPipe) channelId: number,
    @Body() controlMessageDto: ControlMessageDto,
  ) {
    return this.chatsService.controlMessage(
      channelId,
      req.user.userId,
      controlMessageDto.message,
      req.createdAt,
    );
  }
}
