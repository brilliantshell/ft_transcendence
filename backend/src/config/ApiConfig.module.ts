import { Module } from '@nestjs/common';
import { ApiConfigService } from './ApiConfig.service';
import { ConfigService } from '@nestjs/config';

@Module({
  providers: [ApiConfigService, ConfigService],
  exports: [ApiConfigService],
})
export class ApiConfigModule {}
