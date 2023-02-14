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
import { Users } from '../entity/users.entity';
import { UserId } from '../util/type';

interface RefreshTokenWrapper {
  token: string;
  isRevoked: boolean;
}

interface JwtPayload {
  userId: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectRepository(Users)
    private readonly usersRepository: Repository<Users>,
    private readonly jwtService: JwtService,
    @Inject(CACHE_MANAGER) readonly cacheManager: Cache,
    private readonly apiConfigService: ApiConfigService,
  ) {}

  /*****************************************************************************
   *                                                                           *
   * SECTION : Public Methods                                                  *
   *                                                                           *
   ****************************************************************************/

  /*****************************************************************************
   *                                                                           *
   * SECTION : FIXME : Sign-Up                                                 *
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

  // TODO
  // signUp(userId: UserId) {
  //   // 프사 / 닉 저장
  //   // try{
  //   // await this.
  //   // }
  //   return {
  //     accessToken: this.issueAccessToken(userId),
  //     refreshToken: this.issueRefreshToken(userId),
  //   };
  // }
  async login(userId: string) {
    return {
      accessToken: this.issueAccessToken(userId),
      refreshToken: await this.issueRefreshToken(userId),
    };
  }

  /*****************************************************************************
   *                                                                           *
   * SECTION : Manage Access Token                                             *
   *                                                                           *
   ****************************************************************************/

  /**
   * @description 유저 Id 를 통하여 Access Token 발급
   *
   * @param userId 유저 Id
   * @returns Access Token
   */
  issueAccessToken(userId: string) {
    return this.jwtService.sign(
      { userId },
      this.apiConfigService.jwtAccessConfig,
    );
  }

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

  /*****************************************************************************
   *                                                                           *
   * SECTION : Manage Refresh Token                                            *
   *                                                                           *
   ****************************************************************************/

  /**
   * @description 유저 Id 를 통하여 Refresh Token 발급 및 node-cache-manager 에 저장,
   *               이전 토큰 무효화
   *
   * @param userId 유저 Id
   * @returns Refresh Token
   */
  async issueRefreshToken(userId: string) {
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
    if (invalidated === true) {
      await this.invalidateRefreshTokens(payload.userId, refreshTokens);
    }
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
    userId: string,
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
  private async findRefreshTokens(userId: string) {
    return await Promise.all([
      this.cacheManager.get<RefreshTokenWrapper>(userId.toString() + '-prev'),
      this.cacheManager.get<RefreshTokenWrapper>(userId.toString()),
    ]);
  }
}
