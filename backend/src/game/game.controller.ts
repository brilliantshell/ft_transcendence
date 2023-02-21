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
import { InGameUiGuard } from './guard/in-game-ui.guard';
import { InPlayGuard } from './guard/in-play.guard';
import { LadderQueueInterceptor } from './interceptor/ladder-queue.interceptor';
import { LadderStartInterceptor } from './interceptor/ladder-start.interceptor';
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

  @UseGuards(InPlayGuard)
  @UseInterceptors(LadderQueueInterceptor)
  @Post('queue')
  enterLadderQueue() {
    return;
  }

  @UseInterceptors(LadderQueueInterceptor)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete('queue')
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

  @UseGuards(InGameUiGuard)
  @Patch(':gameId/options')
  updateMap(
    @Req() req: VerifiedRequest,
    @Param() { gameId }: GameIdParamDto,
    @Body() { map }: GameMapDto,
  ) {
    this.gameService.changeMap(req.user.userId, gameId, map);
  }

  @UseGuards(InGameUiGuard)
  @UseInterceptors(LadderStartInterceptor)
  @Patch(':gameId/start')
  startGame() {
    return;
  }
}
