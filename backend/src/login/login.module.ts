import { HttpModule } from '@nestjs/axios';
import { Module, forwardRef } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';

import { ApiConfigModule } from '../config/api-config.module';
import { FortyTwoStrategy } from './forty-two.strategy';
import { LoginController } from './login.controller';

@Module({
  imports: [
    HttpModule.register({
      timeout: 5000,
      timeoutErrorMessage: 'Timeout has occurred In 42 API',
    }),
    forwardRef(() => ApiConfigModule),
    PassportModule,
  ],
  controllers: [LoginController],
  providers: [FortyTwoStrategy /* LoginService */],
})
export class LoginModule {}
