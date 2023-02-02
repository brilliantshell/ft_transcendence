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

import { UserGuard } from './user.guard';
import { UserId } from '../util/type';
import { UserService } from './user.service';

@Controller('user')
@UseGuards(UserGuard)
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get(':userId/info')
  findProfile(@Req() req: Request, @Param(':userId') userId: UserId) {}

  /*****************************************************************************
   *                                                                           *
   * SECTION : Game                                                            *
   *                                                                           *
   ****************************************************************************/

  @Post(':userId/game')
  createGame(@Req() req: Request, @Param(':userId') userId: UserId) {}

  @Get(':userId/game/:gameId')
  findGame(@Req() req: Request, @Param(':userId') userId: UserId) {}

  /*****************************************************************************
   *                                                                           *
   * SECTION : Block                                                           *
   *                                                                           *
   ****************************************************************************/

  @Put(':userId/block')
  createBlock(@Req() req: Request, @Param(':userId') userId: UserId) {}

  @Delete(':userId/block')
  deleteBlock(@Req() req: Request, @Param(':userId') userId: UserId) {}

  /*****************************************************************************
   *                                                                           *
   * SECTION : Friend                                                          *
   *                                                                           *
   ****************************************************************************/

  @Get('friends')
  findFriends(@Req() req: Request) {
    // const { userId } = req.user;
    const userId = Math.floor(Number(req.headers['x-user-id']));
    return this.userService.findFriends(userId);
  }

  @Put(':userId/friend')
  createFriendRequest(@Req() req: Request, @Param(':userId') userId: UserId) {}

  @Delete(':userId/friend')
  deleteFriendship(@Req() req: Request, @Param(':userId') userId: UserId) {}

  @Patch(':userId/friend')
  updateFriendship(@Req() req: Request, @Param(':userId') userId: UserId) {}
}
