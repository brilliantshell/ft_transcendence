import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { RanksController } from './ranks.controller';
import { RanksGateway } from './ranks.gateway';
import { RanksService } from './ranks.service';
import { Users } from '../entity/users.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Users])],
  controllers: [RanksController],
  providers: [RanksGateway, RanksService],
  exports: [RanksGateway],
})
export class RanksModule {}
