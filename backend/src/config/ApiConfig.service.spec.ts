import { Test, TestingModule } from '@nestjs/testing';
import { ApiConfigService } from './ApiConfig.service';
import { ConfigService } from '@nestjs/config';

class mockConfigService {
  get(arg: string) {
    return arg;
  }
}

describe('ConfigurationService', () => {
  let service: ApiConfigService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ApiConfigService,
        {
          provide: ConfigService,
          useClass: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<ApiConfigService>(ApiConfigService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('get postgres config', () => {
    expect(service.postgresConfig).toMatchObject({
      type: 'postgres',
      host: 'DB_HOST',
      port: 'DB_PORT',
      username: 'DB_USER',
      password: 'DB_PASSWORD',
      database: 'DB_NAME',
    });
  });
});
