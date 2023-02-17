import {
  CACHE_MANAGER,
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { Cache } from 'cache-manager';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { MailerService } from '@nestjs-modules/mailer';
import { Repository } from 'typeorm';
import { customAlphabet } from 'nanoid';

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
    private readonly mailerService: MailerService,
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
  issueRestrictedAccessToken(userId: UserId) {
    return this.jwtService.sign(
      { userId },
      this.apiConfigService.jwtRestrictedAccessConfig,
    );
  }

  /**
   * @description Login Token 유효성 검사
   *
   * @param token Login Token
   * @returns Login Token Payload (userId) || null
   */
  verifyRestrictedAccessToken(token: string) {
    try {
      return this.jwtService.verify<JwtPayload>(
        token,
        this.apiConfigService.jwtRestrictedAccessSecret,
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
   * SECTION : Two-Factor Authentication                                       *
   *                                                                           *
   ****************************************************************************/

  /**
   * @description Two-Factor Authentication Code 발급 및 이메일 전송
   *
   * @param userId 유저 Id
   * @param email 유저 이메일
   */
  async sendTwoFactorCode(userId: UserId, email: string) {
    const charset = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const code = customAlphabet(charset, 6)(); // from nanoid
    this.cacheManager.set(userId.toString(), code, 900000); // 15 minutes

    // FIXME: enable when mailer is ready
    await this.mailerService.sendMail({
      to: email,
      subject: 'Two-Factor Authentication',
      html: this.generateEmailTemplate(code),
    });
  }

  /**
   * @description Two-Factor Authentication Code 검증
   *
   * @param userId 유저 Id
   * @param code Two-Factor Authentication Code
   * @returns 검증 성공 혹은 throw
   */
  async verifyTwoFactorCode(userId: UserId, code: string) {
    const storedCode = await this.cacheManager.get(userId.toString());
    if (storedCode === code) {
      this.cacheManager.del(userId.toString());
      return true;
    }
    throw new UnauthorizedException(
      'Invalid two-factor code. Please try again',
    );
  }

  /**
   * @description 이메일 내용 생성
   *
   * @param code Two-Factor Authentication Code
   * @returns 이메일 내용
   */
  generateEmailTemplate(code: string) {
    const image =
      "<img src='https://emoji.slack-edge.com/T039P7U66/daebakjule/af8546a21f0db8d4.gif' width='24' height='24'>";
    return `<h1>${image}Your two-factor authentication code is ${code}${image}</h1>`;
  }

  // TODO
  // generateTwoFactorEmailSecret() {
  //   return 'http://localhost:3000/2fa-email/verify?code=' + nanoid();
  // }
  // verifyTwoFactorCode() {}

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
   * @description 유저 Id 를 통하여 Refresh Token 발급 및 node-cache-manager 에 저장,
   *               이전 토큰 무효화
   *
   * @param userId 유저 Id
   * @returns Refresh Token
   */
  private async issueRefreshToken(userId: UserId) {
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
