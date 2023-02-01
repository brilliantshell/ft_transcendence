import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { UserGateway } from './user.gateway';
import { UserService } from './user.service';
import { UserStatusModule } from '../user-status/user-status.module';
import { Users } from '../entity/users.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Users]), UserStatusModule],
  providers: [UserGateway, UserService],
})
export class UserModule {}
