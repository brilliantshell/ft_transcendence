import { ConfigModule } from '@nestjs/config';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ApiConfigModule } from './config/api-config.module';
import { ApiConfigService } from './config/api-config.service';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ChatsModule } from './chats/chats.module';
import { GameModule } from './game/game.module';
import { ProfileModule } from './profile/profile.module';
import { RanksModule } from './ranks/ranks.module';
import { UserModule } from './user/user.module';
import { UserStatusModule } from './user-status/user-status.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: './.env',
    }),
    TypeOrmModule.forRootAsync({
      imports: [ApiConfigModule],
      useFactory: (apiConfigService: ApiConfigService) =>
        apiConfigService.postgresConfig,
      inject: [ApiConfigService],
    }),
    ChatsModule,
    GameModule,
    ProfileModule,
    RanksModule,
    UserModule,
    UserStatusModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
