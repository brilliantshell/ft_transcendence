import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { GameCompleteInterceptor } from './game.interceptor';
import { GameGateway } from './game.gateway';
import { GameStorage } from './game.storage';
import { MatchHistory } from '../entity/match-history.entity';
import { UserStatusModule } from '../user-status/user-status.module';
import { Users } from '../entity/users.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([MatchHistory, Users]),
    forwardRef(() => UserStatusModule),
  ],
  providers: [GameGateway, GameStorage],
  exports: [GameGateway, GameStorage],
})
export class GameModule {}
