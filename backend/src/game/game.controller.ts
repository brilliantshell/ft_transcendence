import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';

import { ExistingGameGuard } from './guard/existing-game.guard';
import { GameIdParamDto, GameModeDto } from './dto/game.dto';
import { GameRequest } from '../util/type';
import { GameService } from './game.service';
import { GameStartInterceptor } from './interceptor/game-start.interceptor';
import { InGameUiGuard } from './guard/in-game-ui.guard';
import { InPlayGuard } from './guard/in-play.guard';
import { IsPlayerGuard } from './guard/is-player.guard';
import { LadderQueueInterceptor } from './interceptor/ladder-queue.interceptor';
import { LadderRestrictionGuard } from './guard/ladder-restriction.guard';
import { MockAuthGuard } from '../guard/mock-auth.guard';

// FIXME: AuthGuard 구현 후 변경
@UseGuards(MockAuthGuard)
@Controller('game')
export class GameController {
  constructor(private readonly gameService: GameService) {}

  /*****************************************************************************
   *                                                                           *
   * SECTION : Waiting room                                                    *
   *                                                                           *
   ****************************************************************************/

  @Get('list')
  findLadderGames() {
    return this.gameService.findLadderGames();
  }

  @Get('list/:gameId')
  @UseGuards(ExistingGameGuard)
  findGameInfo(@Req() req: GameRequest, @Param() { gameId }: GameIdParamDto) {
    return this.gameService.findGameInfo(req.user.userId, gameId, req.gameInfo);
  }

  @Post('queue')
  @UseGuards(InPlayGuard)
  @UseInterceptors(LadderQueueInterceptor)
  enterLadderQueue() {
    return;
  }

  @Delete('queue')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseInterceptors(LadderQueueInterceptor)
  exitLadderQueue() {
    return;
  }

  /*****************************************************************************
   *                                                                           *
   * SECTION : Game UI                                                         *
   *                                                                           *
   ****************************************************************************/

  @Get(':gameId')
  @UseGuards(ExistingGameGuard, IsPlayerGuard)
  findPlayers(@Req() req: GameRequest, @Param() { gameId }: GameIdParamDto) {
    return this.gameService.findPlayers(req.user.userId, gameId, req.gameInfo);
  }

  @Delete(':gameId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(ExistingGameGuard, IsPlayerGuard, LadderRestrictionGuard)
  deleteNormalGame(@Param() { gameId }: GameIdParamDto) {
    this.gameService.deleteCancelledGame(gameId);
  }

  @Patch(':gameId/options')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(
    InGameUiGuard,
    ExistingGameGuard,
    IsPlayerGuard,
    LadderRestrictionGuard,
  )
  updateMode(
    @Req() req: GameRequest,
    @Param() { gameId }: GameIdParamDto,
    @Body() { mode }: GameModeDto,
  ) {
    this.gameService.changeMode(req.user.userId, gameId, req.gameInfo, mode);
  }

  @Patch(':gameId/start')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(InGameUiGuard, ExistingGameGuard, IsPlayerGuard)
  @UseInterceptors(GameStartInterceptor)
  startGame() {
    return;
  }
}
