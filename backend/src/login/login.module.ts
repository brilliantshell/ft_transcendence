import { HttpModule } from '@nestjs/axios';
import { Module, forwardRef } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ApiConfigModule } from '../config/api-config.module';
import { FortyTwoStrategy } from './forty-two.strategy';
import { LoginController } from './login.controller';
import { LoginService } from './login.service';
import { Users } from '../entity/users.entity';

@Module({
  imports: [
    HttpModule.register({
      timeout: 5000,
      timeoutErrorMessage: 'Timeout has occurred In 42 API',
    }),
    TypeOrmModule.forFeature([Users]),
    forwardRef(() => ApiConfigModule),
    PassportModule,
  ],
  controllers: [LoginController],
  providers: [FortyTwoStrategy, LoginService],
})
export class LoginModule {}
