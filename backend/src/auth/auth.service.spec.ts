import { DataSource, Repository } from 'typeorm';
import { MailerService } from '@nestjs-modules/mailer';
import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AppModule } from '../app.module';
import { AuthService } from './auth.service';
import {
  TYPEORM_SHARED_CONFIG,
  createDataSources,
  destroyDataSources,
} from '../../test/util/db-resource-manager';
import { Users } from '../entity/users.entity';
import { generateUsers } from '../../test/util/generate-mock-data';

const TEST_DB = 'test_db_auth_service';
const ENTITIES = [Users];

describe('AuthService', () => {
  let service: AuthService;
  let usersEntities: Users[];
  let initDataSource: DataSource;
  let dataSource: DataSource;
  let usersRepository: Repository<Users>;
  let mailerServiceSendMailSpy: jest.SpyInstance;

  beforeAll(async () => {
    const dataSources = await createDataSources(TEST_DB, ENTITIES);
    initDataSource = dataSources.initDataSource;
    dataSource = dataSources.dataSource;
    usersEntities = generateUsers(10);
    usersRepository = dataSource.getRepository(Users);
    await usersRepository.save(usersEntities);
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'postgres',
          ...TYPEORM_SHARED_CONFIG,
          autoLoadEntities: true,
          database: TEST_DB,
        }),
        AppModule,
      ],
    }).compile();

    const mailerService = module.get<MailerService>(MailerService);
    mailerServiceSendMailSpy = jest
      .spyOn(mailerService, 'sendMail')
      .mockImplementation(() => Promise.resolve());
    service = module.get<AuthService>(AuthService);
  });

  afterAll(async () => {
    await destroyDataSources(TEST_DB, dataSource, initDataSource);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should find user by id', async () => {
    const { userId } = usersEntities[0];
    expect(await service.findUserById(userId)).toBeTruthy();
  });

  it('should not find user by id when user does not exist', async () => {
    const userId = generateUsers(1)[0].userId;
    expect(await service.findUserById(userId)).toBeFalsy();
  });

  it('should issue access token which can verified', async () => {
    const { userId } = usersEntities[0];
    const token = service.issueAccessToken(userId);
    expect(service.verifyAccessToken(token)).toBeTruthy();
  });

  it('should not verify invalid token', async () => {
    expect(service.verifyAccessToken('invalid token')).toBeFalsy();
    expect(service.verifyAccessToken('')).toBeFalsy();
    expect(await service.verifyRefreshToken('')).toBeFalsy();
  });

  it('should issue refresh token which can verified', async () => {
    const { userId } = usersEntities[0];
    const token = await (service as any).issueRefreshToken(userId);
    expect(await service.verifyRefreshToken(token)).toBeTruthy();
  });

  it('should not verify previous refresh token and invalidate all tokens', async () => {
    const { userId } = usersEntities[0];
    const prevToken = await (service as any).issueRefreshToken(userId);
    const token = await (service as any).issueRefreshToken(userId);
    expect(await service.verifyRefreshToken(prevToken)).toBeFalsy();
    expect(await service.verifyRefreshToken(token)).toBeFalsy();
  });

  it('should not verify malformed token and remain token is still valid', async () => {
    const { userId } = usersEntities[0];
    const token = await (service as any).issueRefreshToken(userId);
    expect(await service.verifyRefreshToken(token)).toMatchObject({
      userId: userId,
    });
  });

  it("should not verify valid refresh token but not the users's token and remain token is still valid", async () => {
    const { userId } = usersEntities[0];
    const otherToken = await (service as any).issueRefreshToken(userId + 1);
    const token = await (service as any).issueRefreshToken(userId);
    expect(await service.verifyRefreshToken(otherToken)).not.toMatchObject({
      userId,
    });
    expect(await service.verifyRefreshToken(token)).toMatchObject({
      userId,
    });
  });

  it('should issue login token and can verify', async () => {
    const { userId } = usersEntities[0];
    const token = service.issueRestrictedAccessToken(userId);
    expect(service.verifyRestrictedAccessToken(token).userId).toBe(userId);
  });

  it('should generate 2FA code and verify it', async () => {
    await service.sendTwoFactorCode(12345, '1234@');
    expect(mailerServiceSendMailSpy).toHaveBeenCalled();
    const data = await (service as any).cacheManager.get('12345');
    expect(await service.verifyTwoFactorCode(12345, data.authCode)).toBe(
      '1234@',
    );
    expect(await (service as any).cacheManager.get('12345')).toBeUndefined();
  });
});
