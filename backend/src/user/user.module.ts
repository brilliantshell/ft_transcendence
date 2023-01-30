import { Module } from '@nestjs/common';

import { UserGateway } from './user.gateway';
import { UserStatusModule } from '../user-status/user-status.module';
import { UserService } from './user.service';

@Module({
  imports: [UserStatusModule],
  providers: [UserGateway, UserService],
})
export class UserModule {}
