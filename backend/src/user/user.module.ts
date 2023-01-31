import { Module } from '@nestjs/common';

import { UserGateway } from './user.gateway';
import { UserService } from './user.service';
import { UserStatusModule } from '../user-status/user-status.module';

@Module({
  imports: [UserStatusModule],
  providers: [UserGateway],
  // providers: [UserGateway, UserService],
})
export class UserModule {}
