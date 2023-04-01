import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ChannelMembers } from '../entity/channel-members.entity';
import { Channels } from '../entity/channels.entity';
import { ChatsController } from './chats.controller';
import { ChatsGateway } from './chats.gateway';
import { ChatsService } from './chats.service';
import { Messages } from '../entity/messages.entity';
import { UserStatusModule } from '../user-status/user-status.module';
import { Users } from '../entity/users.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([ChannelMembers, Channels, Messages, Users]),
    forwardRef(() => UserStatusModule),
  ],
  controllers: [ChatsController],
  providers: [ChatsGateway, ChatsService],
  exports: [ChatsGateway],
})
export class ChatsModule {}
