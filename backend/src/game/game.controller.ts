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

import { GameIdParamDto, GameMapDto } from './dto/game.dto';
import { GameService } from './game.service';
import { GameStartInterceptor } from './interceptor/game-start.interceptor';
import { InGameUiGuard } from './guard/in-game-ui.guard';
import { InPlayGuard } from './guard/in-play.guard';
import { LadderQueueInterceptor } from './interceptor/ladder-queue.interceptor';
import { MockAuthGuard } from '../guard/mock-auth.guard';
import { VerifiedRequest } from '../util/type';

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
  findGameInfo(
    @Req() req: VerifiedRequest,
    @Param() { gameId }: GameIdParamDto,
  ) {
    return this.gameService.findGameInfo(req.user.userId, gameId);
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
  findPlayers(
    @Req() req: VerifiedRequest,
    @Param() { gameId }: GameIdParamDto,
  ) {
    return this.gameService.findPlayers(req.user.userId, gameId);
  }

  @Patch(':gameId/options')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(InGameUiGuard)
  updateMap(
    @Req() req: VerifiedRequest,
    @Param() { gameId }: GameIdParamDto,
    @Body() { map }: GameMapDto,
  ) {
    this.gameService.changeMap(req.user.userId, gameId, map);
  }

  @Patch(':gameId/start')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(InGameUiGuard)
  @UseInterceptors(GameStartInterceptor)
  startGame() {
    return;
  }
}
