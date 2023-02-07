import { Module } from '@nestjs/common';
import { GameStorage } from './game.storage';

@Module({
  providers: [GameStorage],
})
export class GameModule {}
