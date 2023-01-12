import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from '@nestjs/config';
import { ApiConfigModule } from './config/ApiConfig.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ApiConfigService } from './config/ApiConfig.service';

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
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
