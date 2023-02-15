import { CacheModule, forwardRef, Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ApiConfigModule } from '../config/api-config.module';
import { ApiConfigService } from '../config/api-config.service';
import { AuthService } from './auth.service';
import { MailerModule } from '@nestjs-modules/mailer';
import { Users } from '../entity/users.entity';

@Global()
@Module({
  imports: [
    CacheModule.register({ ttl: 1209600000 /* 14 days */, max: 40000 }),
    TypeOrmModule.forFeature([Users]),
    forwardRef(() => ApiConfigModule),
    MailerModule.forRootAsync({
      imports: [ApiConfigModule],
      useFactory: (apiConfigService: ApiConfigService) =>
        apiConfigService.mailerConfig,
      inject: [ApiConfigService],
    }),
    JwtModule.register({}),
  ],
  providers: [AuthService],
  exports: [AuthService],
})
export class AuthModule {}
