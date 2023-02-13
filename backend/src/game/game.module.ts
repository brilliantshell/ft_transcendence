import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { GameGateway } from './game.gateway';
import { GameService } from './game.service';
import { GameStorage } from './game.storage';
import { MatchHistory } from '../entity/match-history.entity';
import { RanksModule } from '../ranks/ranks.module';
import { UserStatusModule } from '../user-status/user-status.module';
import { Users } from '../entity/users.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([MatchHistory, Users]),
    RanksModule,
    forwardRef(() => UserStatusModule),
  ],
  providers: [GameGateway, GameService, GameStorage],
  exports: [GameGateway, GameStorage],
})
export class GameModule {}
