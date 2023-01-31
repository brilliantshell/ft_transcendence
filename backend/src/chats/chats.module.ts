import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Channels } from '../entity/channels.entity';
import { ChatsGateway } from './chats.gateway';
import { ChatsService } from './chats.service';
import { UserStatusModule } from '../user-status/user-status.module';
import { BannedMembers } from '../entity/banned-members.entity';
import { Messages } from '../entity/messages.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Channels, BannedMembers, Messages]),
    UserStatusModule,
  ],
  providers: [ChatsGateway, ChatsService],
  exports: [ChatsGateway],
})
export class ChatsModule {}
