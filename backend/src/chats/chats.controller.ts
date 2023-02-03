import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpStatus,
  Param,
  ParseArrayPipe,
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
  findChannelMembers(
    @Req() req: VerifiedRequest,
    @Param('channelId', ParseIntPipe) channelId: number,
  ) {
    return this.chatsService.findChannelMembers(channelId, req.user.userId);
  }

  @Post(':channelId/user/:userId')
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
  findChannelMessages(
    @Req() req: VerifiedRequest,
    @Param('channelId', ParseIntPipe) channelId: number,
    @Query('range', new ParseArrayPipe({ items: Number, separator: ',' }))
    query: Array<number>,
  ) {
    // FIXME : array size of range should be 2
    // FIXME : range validation, move to pipe or ... somewhere
    const MAX_MESSAGE = 10000;
    if (
      query.length !== 2 ||
      query[0] < 0 ||
      query[0] > MAX_MESSAGE ||
      query[1] > MAX_MESSAGE
    ) {
      throw new BadRequestException('Invalid range query');
    }
    return this.chatsService.findChannelMessages(
      channelId,
      req.user.userId,
      query[0],
      query[1],
    );
  }

  @Post(':channelId/message')
  controlMessage(
    @Req() req: VerifiedRequest,
    @Param('channelId', ParseIntPipe) channelId: number,
    @Body() controlMessageDto: ControlMessageDto,
  ) {
    return this.chatsService.controlMessage(
      channelId,
      req.user.userId,
      controlMessageDto.message,
    );
  }
}
