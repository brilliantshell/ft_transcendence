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
import { CreateChannelDto, JoinChannelDto, MessageDto } from './dto/chats.dto';
import { MockAuthGuard } from './guard/mock-auth.guard';
import { Response } from 'express';
import { VerifiedRequest } from '../util/type';
import { ValidateNewChannelPipe } from './pipe/validate-new-channel.pipe';
import { ChannelExistGuard } from './guard/channel-exist.guard';
import { MemberExistGuard } from './guard/member-exist.guard';
import { JoinChannelGuard } from './guard/join-channel.guard';
import { ValidateRangePipe } from './pipe/validate-range.pipe';
import { MemberMessagingGuard } from './guard/member-messaging.guard';
import { MessageTransformPipe } from './message-transform/message-transform.pipe';

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
    @Req() req: /* VerifiedRequest */ any, // TODO : CreatedAt 의 처리 방식 결정 후 수정
    @Param('channelId', ParseIntPipe) channelId: number,
    @Body(MessageTransformPipe) controlMessageDto: MessageDto,
  ) {
    controlMessageDto.command === undefined
      ? this.chatsService.createMessage(
          channelId,
          req.user.userId,
          controlMessageDto.message,
          req.createdAt,
        )
      : this.chatsService.executeCommand(
          channelId,
          req.user.userId,
          controlMessageDto.command,
          req.createdAt,
        );
  }
}
