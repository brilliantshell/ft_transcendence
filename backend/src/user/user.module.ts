import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ChatsModule } from '../chats/chats.module';
import { GameModule } from '../game/game.module';
import { UserController } from './user.controller';
import { UserGateway } from './user.gateway';
import { UserService } from './user.service';
import { UserStatusModule } from '../user-status/user-status.module';
import { Users } from '../entity/users.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Users]),
    forwardRef(() => ChatsModule),
    GameModule,
    forwardRef(() => UserStatusModule),
  ],
  controllers: [UserController],
  providers: [UserGateway, UserService],
  exports: [UserGateway],
})
export class UserModule {}
