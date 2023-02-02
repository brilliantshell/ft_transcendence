import {
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';

import { AcceptFriendGuard } from './guard/accept-friend.guard';
import { BlockedUserGuard } from './guard/blocked-user.guard';
import { CreateFriendRequestGuard } from './guard/create-friend-request.guard';
import { DeleteFriendGuard } from './guard/delete-friend.guard';
import { DeleteBlockGuard } from './guard/delete-block.guard';
import { UserExistGuard } from './guard/user-exist.guard';
import { UserId, VerifiedRequest } from '../util/type';
import { UserService } from './user.service';

@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get(':userId/info')
  @UseGuards(UserExistGuard)
  findProfile(@Req() req: Request, @Param(':userId') userId: UserId) {}

  /*****************************************************************************
   *                                                                           *
   * SECTION : Game                                                            *
   *                                                                           *
   ****************************************************************************/

  @Post(':userId/game')
  @UseGuards(UserExistGuard, BlockedUserGuard)
  createGame(@Req() req: Request, @Param(':userId') userId: UserId) {}

  @Get(':userId/game/:gameId')
  @UseGuards(UserExistGuard, BlockedUserGuard)
  findGame(@Req() req: Request, @Param(':userId') userId: UserId) {}

  /*****************************************************************************
   *                                                                           *
   * SECTION : Block                                                           *
   *                                                                           *
   ****************************************************************************/

  @Put(':userId/block')
  @UseGuards(UserExistGuard, BlockedUserGuard)
  createBlock(@Req() req: Request, @Param(':userId') userId: UserId) {}

  @Delete(':userId/block')
  @UseGuards(UserExistGuard, BlockedUserGuard, DeleteBlockGuard)
  deleteBlock(@Req() req: Request, @Param(':userId') userId: UserId) {}

  /*****************************************************************************
   *                                                                           *
   * SECTION : Friend                                                          *
   *                                                                           *
   ****************************************************************************/

  @Get('friends')
  findFriends(@Req() req: VerifiedRequest) {
    // return this.userService.findFriends(
    //   process.env.NODE_ENV === 'development'
    //     ? Math.floor(Number(req.headers['x-user-id']))
    //     : req.user.userId,
    // );
  }

  @Put(':userId/friend')
  @UseGuards(UserExistGuard, BlockedUserGuard, CreateFriendRequestGuard)
  createFriendRequest(@Req() req: Request, @Param(':userId') userId: UserId) {}

  @Delete(':userId/friend')
  @UseGuards(UserExistGuard, BlockedUserGuard, DeleteFriendGuard)
  deleteFriendship(@Req() req: Request, @Param(':userId') userId: UserId) {}

  @Patch(':userId/friend')
  @UseGuards(UserExistGuard, BlockedUserGuard, AcceptFriendGuard)
  updateFriendship(@Req() req: Request, @Param(':userId') userId: UserId) {}
}
