import { Module } from '@nestjs/common';

import { ChatsGateway } from './chats.gateway';
import { UserStatusModule } from '../user-status/user-status.module';
import { ChatsService } from './chats.service';

@Module({
  imports: [UserStatusModule],
  providers: [ChatsGateway, ChatsService],
  exports: [ChatsGateway],
})
export class ChatsModule {}
