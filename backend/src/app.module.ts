import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { Module } from '@nestjs/common';
import { ServeStaticModule } from '@nestjs/serve-static';
import { TypeOrmModule } from '@nestjs/typeorm';
import { join } from 'path';

import { ApiConfigModule } from './config/api-config.module';
import { ApiConfigService } from './config/api-config.service';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { ChatsModule } from './chats/chats.module';
import { GameModule } from './game/game.module';
import { JwtAuthGuard } from './auth/jwt-auth.guard';
import { LoginModule } from './login/login.module';
import { ProfileModule } from './profile/profile.module';
import { RanksModule } from './ranks/ranks.module';
import { UserModule } from './user/user.module';
import { UserStatusModule } from './user-status/user-status.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: './.env',
    }),
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', 'asset'),
      serveRoot: '/asset/',
      serveStaticOptions: {
        index: false,
      },
    }),
    TypeOrmModule.forRootAsync({
      imports: [ApiConfigModule],
      useFactory: (apiConfigService: ApiConfigService) =>
        apiConfigService.postgresConfig,
      inject: [ApiConfigService],
    }),
    AuthModule,
    ChatsModule,
    GameModule,
    LoginModule,
    ProfileModule,
    RanksModule,
    UserModule,
    UserStatusModule,
  ],
  controllers: [AppController],
  providers: [AppService, { provide: APP_GUARD, useClass: JwtAuthGuard }],
})
export class AppModule {}
