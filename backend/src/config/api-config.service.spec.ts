import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';

import { ApiConfigService } from './api-config.service';

class mockApiConfigService {
  get(arg: string) {
    return arg;
  }
}

describe('ApiConfigService', () => {
  let apiConfigService: ApiConfigService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ApiConfigService,
        {
          provide: ConfigService,
          useClass: mockApiConfigService,
        },
      ],
    }).compile();

    apiConfigService = module.get<ApiConfigService>(ApiConfigService);
  });

  it('should be defined', () => {
    expect(apiConfigService).toBeDefined();
  });

  it('get postgres config', () => {
    expect(apiConfigService.postgresConfig).toMatchObject({
      type: 'postgres',
      host: 'DB_HOST',
      port: 'DB_PORT',
      username: 'DB_USER',
      password: 'DB_PASSWORD',
      database: 'DB_NAME',
    });
  });
});
