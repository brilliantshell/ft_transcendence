import { ConfigService } from '@nestjs/config';
import { Module } from '@nestjs/common';

import { ApiConfigService } from './api-config.service';

@Module({
  providers: [ApiConfigService, ConfigService],
  exports: [ApiConfigService],
})
export class ApiConfigModule {}
