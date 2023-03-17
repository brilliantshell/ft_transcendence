import { AuthGuard } from '@nestjs/passport';
import {
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Response } from 'express';

import {
  ACCESS_TOKEN_COOKIE_OPTIONS,
  COOKIE_OPTIONS,
  REFRESH_TOKEN_COOKIE_OPTIONS,
} from '../util/constant/cookie-constant';
import { AuthService } from '../auth/auth.service';
import { LoginRequest } from '../util/type';

@Injectable()
export class FortyTwoGuard extends AuthGuard('42') {
  constructor(private readonly authService: AuthService) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if ((await super.canActivate(context)) === false) {
      throw new UnauthorizedException('Failed to authenticate with 42');
    }
    const { userId, isRegistered, authEmail } = context
      .switchToHttp()
      .getRequest<LoginRequest>().user;
    const res = context.switchToHttp().getResponse<Response>();
    if (!isRegistered || authEmail) {
      authEmail && this.authService.sendTwoFactorCode(userId, authEmail);
      const restrictedAccessToken =
        this.authService.issueRestrictedAccessToken(userId);
      res.cookie('restrictedAccessToken', restrictedAccessToken, {
        ...COOKIE_OPTIONS,
        maxAge: 900000, // 15 minutes
      });
      return true;
    }
    const { accessToken, refreshToken } = await this.authService.issueTokens(
      userId,
    );
    res
      .cookie('accessToken', accessToken, ACCESS_TOKEN_COOKIE_OPTIONS)
      .cookie('refreshToken', refreshToken, REFRESH_TOKEN_COOKIE_OPTIONS);
    return true;
  }
}
