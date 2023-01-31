import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Channels } from '../entity/channels.entity';
import { ChatsGateway } from './chats.gateway';
import { ChatsService } from './chats.service';
import { UserStatusModule } from '../user-status/user-status.module';
import { BannedMembers } from 'src/entity/banned-members.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Channels, BannedMembers]),
    UserStatusModule,
  ],
  providers: [ChatsGateway, ChatsService],
  exports: [ChatsGateway],
})
export class ChatsModule {}
