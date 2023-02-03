import {
  Controller,
  Delete,
  Get,
  HttpStatus,
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
import { RelationshipRequest, VerifiedRequest } from '../util/type';
import { SelfCheckGuard } from './guard/self-check.guard';
import { UserExistGuard } from './guard/user-exist.guard';
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
  async createBlock(@Req() req: RelationshipRequest, @Res() res: Response) {
    res
      .status(
        (await this.userService.createBlock(req.user.userId, req.targetId))
          ? 201
          : 200,
      )
      .end();
  }

  @Delete(':userId/block')
  @UseGuards(SelfCheckGuard, UserExistGuard, BlockedUserGuard, DeleteBlockGuard)
  async deleteBlock(@Req() req: RelationshipRequest) {
    await this.userService.deleteBlock(req.user.userId, req.targetId);
  }

  /*****************************************************************************
   *                                                                           *
   * SECTION : DM                                                              *
   *                                                                           *
   ****************************************************************************/

  @Put(':userId/dm')
  @UseGuards(SelfCheckGuard, UserExistGuard)
  async createDm(@Req() req: RelationshipRequest, @Res() res: Response) {
    const { dmId, isNew } = await this.userService.createDm(
      req.user.userId,
      req.targetId,
    );
    res
      .status(isNew ? HttpStatus.CREATED : HttpStatus.OK)
      .set('location', `/chats/${dmId}`)
      .end();
  }

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
    @Req() req: RelationshipRequest,
    @Res() res: Response,
  ) {
    res
      .status(
        (await this.userService.createFriendRequest(
          req.user.userId,
          req.targetId,
        ))
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
  async deleteFriendship(@Req() req: RelationshipRequest) {
    await this.userService.deleteFriendship(req.user.userId, req.targetId);
  }

  @Patch(':userId/friend')
  @UseGuards(
    SelfCheckGuard,
    UserExistGuard,
    BlockedUserGuard,
    AcceptFriendGuard,
  )
  async updateFriendship(@Req() req: RelationshipRequest) {
    await this.userService.acceptFriendRequest(req.user.userId, req.targetId);
  }

  /*****************************************************************************
   *                                                                           *
   * TODO : Game                                                               *
   *                                                                           *
   ****************************************************************************/

  @Post(':userId/game')
  @UseGuards(SelfCheckGuard, UserExistGuard, BlockedUserGuard)
  createGame(@Req() req: RelationshipRequest) {}

  @Get(':userId/game/:gameId')
  @UseGuards(SelfCheckGuard, UserExistGuard, BlockedUserGuard)
  findGame(@Req() req: RelationshipRequest) {}

  /*****************************************************************************
   *                                                                           *
   * SECTION : UserProfile                                                     *
   *                                                                           *
   ****************************************************************************/

  @Get(':userId/info')
  @UseGuards(UserExistGuard)
  async findProfile(@Req() req: RelationshipRequest) {
    return await this.userService.findProfile(req.user.userId, req.targetId);
  }
}
