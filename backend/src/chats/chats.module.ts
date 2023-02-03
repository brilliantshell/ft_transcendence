import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Channels } from '../entity/channels.entity';
import { ChatsController } from './chats.controller';
import { ChatsGateway } from './chats.gateway';
import { ChatsService } from './chats.service';
import { Messages } from '../entity/messages.entity';
import { UserStatusModule } from '../user-status/user-status.module';

@Module({
  imports: [TypeOrmModule.forFeature([Channels, Messages]), UserStatusModule],
  providers: [ChatsGateway, ChatsService],
  exports: [ChatsGateway],
  controllers: [ChatsController],
})
export class ChatsModule {}
