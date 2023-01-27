import { Module } from '@nestjs/common';

import { UserGateway } from './user.gateway';
import { UserStatusModule } from '../user-status/user-status.module';

@Module({
  imports: [UserStatusModule],
  providers: [UserGateway],
})
export class UserModule {}
