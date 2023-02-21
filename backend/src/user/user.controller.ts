import {
  Controller,
  Delete,
  Get,
  HttpCode,
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
import { CreateGameGuard } from './guard/create-game.guard';
import { DeleteFriendGuard } from './guard/delete-friend.guard';
import { DeleteBlockGuard } from './guard/delete-block.guard';
import { GameService } from '../game/game.service';
import { RelationshipRequest, VerifiedRequest } from '../util/type';
import { SelfCheckGuard } from './guard/self-check.guard';
import { UserExistGuard } from './guard/user-exist.guard';
import { UserService } from './user.service';

@Controller('user')
export class UserController {
  constructor(
    private readonly gameService: GameService,
    private readonly userService: UserService,
  ) {}

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
          ? HttpStatus.CREATED
          : HttpStatus.NO_CONTENT,
      )
      .end();
  }

  @Delete(':userId/block')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(SelfCheckGuard, UserExistGuard, BlockedUserGuard, DeleteBlockGuard)
  deleteBlock(@Req() req: RelationshipRequest) {
    this.userService.deleteBlock(req.user.userId, req.targetId);
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
      .status(isNew ? HttpStatus.CREATED : HttpStatus.NO_CONTENT)
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
          : HttpStatus.NO_CONTENT,
      )
      .end();
  }

  @Delete(':userId/friend')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(
    SelfCheckGuard,
    UserExistGuard,
    BlockedUserGuard,
    DeleteFriendGuard,
  )
  deleteFriendship(@Req() req: RelationshipRequest) {
    this.userService.deleteFriendship(req.user.userId, req.targetId);
  }

  @Patch(':userId/friend')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(
    SelfCheckGuard,
    UserExistGuard,
    BlockedUserGuard,
    AcceptFriendGuard,
  )
  updateFriendship(@Req() req: RelationshipRequest) {
    this.userService.acceptFriendRequest(req.user.userId, req.targetId);
  }

  /*****************************************************************************
   *                                                                           *
   * SECTION : Game                                                            *
   *                                                                           *
   ****************************************************************************/

  @Post(':userId/game')
  @UseGuards(SelfCheckGuard, UserExistGuard, BlockedUserGuard, CreateGameGuard)
  async createNormalGame(
    @Req() req: RelationshipRequest,
    @Res() res: Response,
  ) {
    res
      .set(
        'location',
        '/game/' +
          (await this.gameService.createNormalGame(
            req.user.userId,
            req.targetId,
          )),
      )
      .end();
  }

  /*****************************************************************************
   *                                                                           *
   * SECTION : UserProfile                                                     *
   *                                                                           *
   ****************************************************************************/

  @Get('id')
  findId(@Req() req: VerifiedRequest) {
    return {
      userId:
        process.env.NODE_ENV === 'development'
          ? Math.floor(Number(req.headers['x-user-id']))
          : req.user.userId,
    };
  }

  @Get(':userId/info')
  @UseGuards(UserExistGuard)
  findProfile(@Req() req: RelationshipRequest) {
    return this.userService.findProfile(req.user.userId, req.targetId);
  }
}
