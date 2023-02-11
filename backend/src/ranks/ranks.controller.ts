import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';

import { MockAuthGuard } from '../guard/mock-auth.guard';
import { RanksService } from './ranks.service';
import { ValidateRangePipe } from '../pipe/validate-range.pipe';
import { VerifiedRequest } from '../util/type';

const RANGE_LIMIT_MAX = 100;

// FIXME: AuthGuard 구현 후 변경
@UseGuards(MockAuthGuard)
@Controller('ranks')
export class RanksController {
  constructor(private readonly ranksService: RanksService) {}

  @Get()
  findRanks(
    @Query('range', new ValidateRangePipe(RANGE_LIMIT_MAX))
    [offset, limit]: [number, number],
  ) {
    return this.ranksService.findRanks(offset, limit);
  }

  @Get('my-rank')
  findMyRank(@Req() req: VerifiedRequest) {
    return this.ranksService.findPosition(req.user.userId);
  }
}
