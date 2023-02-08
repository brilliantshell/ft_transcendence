import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { GameGateway } from './game.gateway';
import { GameStorage } from './game.storage';
import { MatchHistory } from '../entity/match-history.entity';
import { Users } from '../entity/users.entity';

@Module({
  imports: [TypeOrmModule.forFeature([MatchHistory, Users])],
  providers: [GameGateway, GameStorage],
  exports: [GameGateway, GameStorage],
})
export class GameModule {}
