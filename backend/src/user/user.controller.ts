import {
  Controller,
  Delete,
  Get,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Response } from 'express';

import { AcceptFriendGuard } from './guard/accept-friend.guard';
import { BlockedUserGuard } from './guard/blocked-user.guard';
import { CreateFriendRequestGuard } from './guard/create-friend-request.guard';
import { DeleteFriendGuard } from './guard/delete-friend.guard';
import { DeleteBlockGuard } from './guard/delete-block.guard';
import { SelfCheckGuard } from './guard/self-check.guard';
import { UserExistGuard } from './guard/user-exist.guard';
import { UserId, VerifiedRequest } from '../util/type';
import { UserService } from './user.service';

@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  /*****************************************************************************
   *                                                                           *
   * SECTION : Block                                                           *
   *                                                                           *
   ****************************************************************************/

  @Put(':userId/block')
  @UseGuards(SelfCheckGuard, UserExistGuard, BlockedUserGuard)
  async createBlock(
    @Req() req: VerifiedRequest,
    @Param('userId', ParseIntPipe) targetId: UserId,
    @Res() res: Response,
  ) {
    res
      .status(
        (await this.userService.createBlock(req.user.userId, targetId))
          ? 201
          : 200,
      )
      .end();
  }

  @Delete(':userId/block')
  @UseGuards(SelfCheckGuard, UserExistGuard, BlockedUserGuard, DeleteBlockGuard)
  async deleteBlock(
    @Req() req: VerifiedRequest,
    @Param('userId', ParseIntPipe) targetId: UserId,
  ) {
    await this.userService.deleteBlock(req.user.userId, targetId);
  }

  /*****************************************************************************
   *                                                                           *
   * SECTION : DM                                                              *
   *                                                                           *
   ****************************************************************************/

  /*****************************************************************************
   *                                                                           *
   * SECTION : Friend                                                          *
   *                                                                           *
   ****************************************************************************/

  @Get('friends')
  findFriends(@Req() req: VerifiedRequest) {
    return this.userService.findFriends(
      process.env.NODE_ENV === 'development'
        ? Math.floor(Number(req.headers['x-user-id']))
        : req.user.userId,
    );
  }

  @Put(':userId/friend')
  @UseGuards(
    SelfCheckGuard,
    UserExistGuard,
    BlockedUserGuard,
    CreateFriendRequestGuard,
  )
  async createFriendRequest(
    @Req() req: VerifiedRequest,
    @Param('userId', ParseIntPipe) targetId: UserId,
    @Res() res: Response,
  ) {
    res
      .status(
        (await this.userService.createFriendRequest(req.user.userId, targetId))
          ? HttpStatus.CREATED
          : HttpStatus.OK,
      )
      .end();
  }

  @Delete(':userId/friend')
  @UseGuards(
    SelfCheckGuard,
    UserExistGuard,
    BlockedUserGuard,
    DeleteFriendGuard,
  )
  async deleteFriendship(
    @Req() req: VerifiedRequest,
    @Param('userId', ParseIntPipe) targetId: UserId,
  ) {
    await this.userService.deleteFriendship(req.user.userId, targetId);
  }

  @Patch(':userId/friend')
  @UseGuards(
    SelfCheckGuard,
    UserExistGuard,
    BlockedUserGuard,
    AcceptFriendGuard,
  )
  async updateFriendship(
    @Req() req: VerifiedRequest,
    @Param('userId', ParseIntPipe) targetId: UserId,
  ) {
    await this.userService.acceptFriendRequest(req.user.userId, targetId);
  }

  // TODO
  /*****************************************************************************
   *                                                                           *
   * SECTION : Game                                                            *
   *                                                                           *
   ****************************************************************************/

  @Post(':userId/game')
  @UseGuards(SelfCheckGuard, UserExistGuard, BlockedUserGuard)
  createGame(@Req() req: VerifiedRequest, @Param('userId') userId: UserId) {}

  @Get(':userId/game/:gameId')
  @UseGuards(SelfCheckGuard, UserExistGuard, BlockedUserGuard)
  findGame(
    @Req() req: VerifiedRequest,
    @Param() params: { userId: UserId; gameId: number },
  ) {}

  /*****************************************************************************
   *                                                                           *
   * SECTION : UserProfile                                                     *
   *                                                                           *
   ****************************************************************************/

  @Get(':userId/info')
  @UseGuards(UserExistGuard)
  async findProfile(
    @Req() req: VerifiedRequest,
    @Param('userId', ParseIntPipe) targetId: UserId,
  ) {
    return await this.userService.findProfile(req.user.userId, targetId);
  }
}
