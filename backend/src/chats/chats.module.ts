import { Module } from '@nestjs/common';

import { ChatsGateway } from './chats.gateway';
import { UserStatusModule } from '../user-status/user-status.module';

@Module({
  imports: [UserStatusModule],
  providers: [ChatsGateway],
  exports: [ChatsGateway],
})
export class ChatsModule {}
