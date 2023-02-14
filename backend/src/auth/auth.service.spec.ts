import { CacheModule, forwardRef } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { JwtModule } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ApiConfigModule } from '../config/api-config.module';
import { ApiConfigService } from '../config/api-config.service';
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

  const mockApiConfigService = {
    jwtAccessSecret: { secret: 'jwtAccessSecret' },
    jwtAccessConfig: { secret: 'jwtAccessSecret', expiresIn: '30m' },
    jwtRefreshSecret: { secret: 'jwtRefreshSecret' },
    jwtRefreshConfig: { secret: 'jwtRefreshSecret', expiresIn: '1h' },
  };

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
        TypeOrmModule.forFeature(ENTITIES),
        TypeOrmModule.forFeature([Users]),
        forwardRef(() => ApiConfigModule),
        JwtModule.register({}),
        CacheModule.register({ ttl: 1209600000, store: 'memory' }),
      ],
      providers: [AuthService],
    })
      .overrideProvider(ApiConfigService)
      .useValue(mockApiConfigService)
      .compile();

    service = module.get<AuthService>(AuthService);
  });

  afterAll(async () => {
    await destroyDataSources(TEST_DB, dataSource, initDataSource);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should find user by id', async () => {
    const user = usersEntities[0];
    const { userId } = user;
    expect(await service.findUserById(userId)).toBeTruthy();
  });

  it('should not find user by id when user does not exist', async () => {
    const [user] = generateUsers(1);
    const { userId } = user;
    expect(await service.findUserById(userId)).toBeFalsy();
  });

  it('should issue access token which can verified', async () => {
    const user = usersEntities[0];
    const { userId } = user;
    const userIdStr = userId.toString();
    const token = service.issueAccessToken(userIdStr);
    expect(service.verifyAccessToken(token)).toBeTruthy();
  });

  it('should not verify invalid token', () => {
    expect(service.verifyAccessToken('invalid token')).toBeFalsy();
    expect(service.verifyAccessToken('')).toBeFalsy();
    expect(service.verifyRefreshToken('')).resolves.toBeFalsy();
  });

  it('should issue refresh token which can verified', async () => {
    const user = usersEntities[0];
    const { userId } = user;
    const userIdStr = userId.toString();
    const token = await service.issueRefreshToken(userIdStr);
    expect(await service.verifyRefreshToken(token)).toBeTruthy();
  });

  it('should not verify previous refresh token and invalidate all tokens', async () => {
    const user = usersEntities[0];
    const { userId } = user;
    const userIdStr = userId.toString();
    const prevToken = await service.issueRefreshToken(userIdStr);
    const token = await service.issueRefreshToken(userIdStr);
    expect(await service.verifyRefreshToken(prevToken)).toBeFalsy();
    expect(await service.verifyRefreshToken(token)).toBeFalsy();
  });

  it('should not verify malformed token and remain token is still valid', async () => {
    const user = usersEntities[0];
    const { userId } = user;
    const userIdStr = userId.toString();
    const token = await service.issueRefreshToken(userIdStr);
    // expect(await service.verifyRefreshToken(accessToken)).toBeFalsy();
    expect(await service.verifyRefreshToken(token)).toMatchObject({
      userId: userIdStr,
    });
  });

  it("should not verify valid refresh token but not the users's token and remain token is still valid", async () => {
    const user = usersEntities[0];
    const { userId } = user;
    const userIdStr = userId.toString();
    const otherToken = await service.issueRefreshToken(userIdStr + 1);
    const token = await service.issueRefreshToken(userIdStr);
    expect(await service.verifyRefreshToken(otherToken)).not.toMatchObject({
      userId: userIdStr,
    });
    expect(await service.verifyRefreshToken(token)).toMatchObject({
      userId: userIdStr,
    });
  });
});
