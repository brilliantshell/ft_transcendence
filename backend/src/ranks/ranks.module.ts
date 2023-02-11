import { Module } from '@nestjs/common';
import { RanksGateway } from './ranks.gateway';
import { RanksService } from './ranks.service';

@Module({
  providers: [RanksGateway, RanksService],
  exports: [RanksGateway],
})
export class RanksModule {}
