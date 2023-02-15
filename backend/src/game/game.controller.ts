import {
  Controller,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';

import { GameIdParamDto } from './dto/game.dto';
import { GameService } from './game.service';
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

  @UseGuards(InPlayGuard)
  @UseInterceptors(LadderQueueInterceptor)
  @Post('queue')
  enterLadderQueue() {
    return;
  }

  /*****************************************************************************
   *                                                                           *
   * SECTION : Game UI                                                         *
   *                                                                           *
   ****************************************************************************/
}
