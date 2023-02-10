import { Module } from '@nestjs/common';
import { RanksGateway } from './ranks.gateway';

@Module({
  providers: [RanksGateway],
  exports: [RanksGateway],
})
export class RanksModule {}
