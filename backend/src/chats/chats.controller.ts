import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';

import { ChatsService } from './chats.service';
import { ChannelExistGuard } from './guard/channel-exist.guard';
import { ChannelId, UserId, VerifiedRequest } from '../util/type';
import { CreateChannelDto, JoinChannelDto, MessageDto } from './dto/chats.dto';
import { JoinChannelGuard } from './guard/join-channel.guard';
import { MockAuthGuard } from '../guard/mock-auth.guard';
import { MemberExistGuard } from './guard/member-exist.guard';
import { MemberMessagingGuard } from './guard/member-messaging.guard';
import { MessageTransformPipe } from './pipe/message-transform.pipe';
import { Response } from 'express';
import { ValidateNewChannelPipe } from './pipe/validate-new-channel.pipe';
import { ValidateRangePipe } from '../pipe/validate-range.pipe';

const RANGE_LIMIT_MAX = 10000;

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
  findChannelMembers(@Param('channelId', ParseIntPipe) channelId: ChannelId) {
    return this.chatsService.findChannelMembers(channelId);
  }

  @Put(':channelId/user/:userId')
  @UseGuards(ChannelExistGuard, JoinChannelGuard)
  async joinChannel(
    @Req() req: VerifiedRequest,
    @Res() res: Response,
    @Param('channelId', ParseIntPipe) channelId: ChannelId,
    @Param('userId', ParseIntPipe) userId: UserId,
    @Body() joinChannelDto: JoinChannelDto,
  ) {
    const isNewMember = await this.chatsService.joinChannel(
      channelId,
      userId,
      userId !== req.user.userId,
      joinChannelDto.password || null,
    );
    res.status(isNewMember ? HttpStatus.CREATED : HttpStatus.NO_CONTENT).end();
  }

  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete(':channelId/user')
  @UseGuards(ChannelExistGuard, MemberExistGuard)
  leaveChannel(
    @Req() req: VerifiedRequest,
    @Param('channelId', ParseIntPipe) channelId: ChannelId,
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
    @Param('channelId', ParseIntPipe) channelId: ChannelId,
    @Query('range', new ValidateRangePipe(RANGE_LIMIT_MAX))
    range: [offset: number, limit: number],
  ) {
    return this.chatsService.findChannelMessages(channelId, range[0], range[1]);
  }

  @Post(':channelId/message')
  @UseGuards(ChannelExistGuard, MemberExistGuard, MemberMessagingGuard)
  controlMessage(
    @Req() req: VerifiedRequest,
    @Param('channelId', ParseIntPipe) channelId: ChannelId,
    @Body(MessageTransformPipe) controlMessageDto: MessageDto,
  ) {
    const { message, command } = controlMessageDto;
    command === undefined
      ? this.chatsService.createMessage(channelId, req.user.userId, message)
      : this.chatsService.executeCommand(channelId, req.user.userId, command);
  }
}
