import { Module } from '@nestjs/common';

import { GameGateway } from './game.gateway';
import { GameStorage } from './game.storage';

@Module({
  providers: [GameGateway, GameStorage],
})
export class GameModule {}
