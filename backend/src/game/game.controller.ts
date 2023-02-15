import { Controller, Get, Param, Req, UseGuards } from '@nestjs/common';

import { GameIdParamDto } from './dto/game.dto';
import { GameService } from './game.service';
import { MockAuthGuard } from '../guard/mock-auth.guard';
import { VerifiedRequest } from '../../dist/util/type.d';

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

  /*****************************************************************************
   *                                                                           *
   * SECTION : Game UI                                                         *
   *                                                                           *
   ****************************************************************************/
}
