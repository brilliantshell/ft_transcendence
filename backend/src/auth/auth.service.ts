import {
  CACHE_MANAGER,
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { Cache } from 'cache-manager';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { ApiConfigService } from '../config/api-config.service';
import { JwtPayload, RefreshTokenWrapper, UserId } from '../util/type';
import { Users } from '../entity/users.entity';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly apiConfigService: ApiConfigService,
    @Inject(CACHE_MANAGER) readonly cacheManager: Cache,
    private readonly jwtService: JwtService,
    @InjectRepository(Users)
    private readonly usersRepository: Repository<Users>,
  ) {}

  /*****************************************************************************
   *                                                                           *
   * SECTION : Public Methods                                                  *
   *                                                                           *
   ****************************************************************************/

  /*****************************************************************************
   *                                                                           *
   * SECTION : Sign-up                                                         *
   *                                                                           *
   ****************************************************************************/

  async findUserById(userId: UserId) {
    try {
      return await this.usersRepository.exist({ where: { userId } });
    } catch (e) {
      this.logger.error(e);
      throw new InternalServerErrorException(`Failed to find user (${userId})`);
    }
  }

  /**
   * @description 유저 Id 를 통하여 Login Token 발급
   *
   * @param userId 유저 Id
   * @returns Login Token
   */
  issueLoginToken(userId: UserId) {
    return this.jwtService.sign(
      { userId },
      this.apiConfigService.jwtLoginConfig,
    );
  }

  /**
   * @description Login Token 유효성 검사
   *
   * @param token Login Token
   * @returns Login Token Payload (userId) || null
   */
  verifyLoginToken(token: string) {
    try {
      return this.jwtService.verify<JwtPayload>(
        token,
        this.apiConfigService.jwtLoginSecret,
      );
    } catch {
      return null;
    }
  }

  /*****************************************************************************
   *                                                                           *
   * SECTION : Issue and Delete Access/Refresh Token                           *
   *                                                                           *
   ****************************************************************************/

  /**
   * @description 유저 Id 를 통하여 Access Token, Refresh Token 발급
   *
   * @param userId 유저 Id
   * @returns Access Token, Refresh Token
   */
  async issueTokens(userId: UserId) {
    return {
      accessToken: this.issueAccessToken(userId),
      refreshToken: await this.issueRefreshToken(userId),
    };
  }

  /**
   * @description 유저 Id 를 통하여 Access Token 발급
   *
   * @param userId 유저 Id
   * @returns Access Token
   */
  issueAccessToken(userId: UserId) {
    return this.jwtService.sign(
      { userId },
      this.apiConfigService.jwtAccessConfig,
    );
  }

  /**
   * @description 유저 Id 를 통하여 Refresh Token 발급 및 node-cache-manager 에 저장,
   *               이전 토큰 무효화
   *
   * @param userId 유저 Id
   * @returns Refresh Token
   */
  async issueRefreshToken(userId: UserId) {
    const token = this.jwtService.sign(
      { userId },
      this.apiConfigService.jwtRefreshConfig,
    );
    const prevToken = await this.cacheManager.get<RefreshTokenWrapper>(
      userId.toString(),
    );
    await Promise.all([
      prevToken &&
        this.cacheManager.set(userId.toString() + '-prev', {
          token: prevToken.token,
          isRevoked: true,
        }),
      this.cacheManager.set(userId.toString(), {
        token,
        isRevoked: false,
      }),
    ]);
    return token;
  }

  /**
   * @description 유저의 Refresh Token Family 삭제
   *
   * @param userId
   */
  async clearRefreshTokens(userId: UserId) {
    await this.cacheManager.del(userId.toString());
  }

  /*****************************************************************************
   *                                                                           *
   * SECTION : Verify token                                                    *
   *                                                                           *
   ****************************************************************************/

  /**
   * @description Access Token 유효성 검사
   *
   * @param token Access Token
   * @returns Access Token Payload (userId) || null
   */
  verifyAccessToken(token: string) {
    try {
      return this.jwtService.verify<JwtPayload>(
        token,
        this.apiConfigService.jwtAccessSecret,
      );
    } catch {
      return null;
    }
  }

  /**
   * @description Refresh Token 유효성 검사, 탈취 가능성이 있으면 모든 토큰 무효화
   *
   * @param token Refresh Token
   * @returns Refresh Token Payload (userId) || null
   */
  async verifyRefreshToken(token: string): Promise<JwtPayload> {
    let payload: JwtPayload;
    try {
      payload = this.jwtService.verify<JwtPayload>(
        token,
        this.apiConfigService.jwtRefreshSecret,
      );
    } catch {
      return null;
    }
    const refreshTokens = await this.findRefreshTokens(payload.userId);
    const invalidated = refreshTokens.find(
      (storedToken) => storedToken?.token === token,
    )?.isRevoked;
    if (invalidated === false) {
      return payload;
    }
    await this.invalidateRefreshTokens(payload.userId, refreshTokens);
    this.logger.error(`Refresh Token for user ${payload.userId} is invalid`);
    return null;
  }

  /*****************************************************************************
   *                                                                           *
   * SECTION : Private Methods                                                 *
   *                                                                           *
   ****************************************************************************/

  /**
   * @description 유저가 소유한 Refresh Token 모두 무효화
   *
   * @param userId 유저 Id
   * @param refreshTokens 유저의 Refresh Token Family
   */
  private async invalidateRefreshTokens(
    userId: UserId,
    refreshTokens: [RefreshTokenWrapper, RefreshTokenWrapper],
  ) {
    await Promise.all(
      refreshTokens.map((refreshToken, i) => {
        refreshToken &&
          this.cacheManager.set(userId.toString() + (i === 0 ? '-prev' : ''), {
            token: refreshToken.token,
            isRevoked: true,
          });
      }),
    );
  }

  /**
   * @description 유저가 소유한 Refresh Token Family 조회
   *
   * @param userId
   * @returns
   */
  private async findRefreshTokens(userId: UserId) {
    return await Promise.all([
      this.cacheManager.get<RefreshTokenWrapper>(userId.toString() + '-prev'),
      this.cacheManager.get<RefreshTokenWrapper>(userId.toString()),
    ]);
  }
}
