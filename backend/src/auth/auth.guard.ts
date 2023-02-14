import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { CookieOptions, Request, Response } from 'express';

import { AuthService } from './auth.service';

const COOKIE_OPTIONS: CookieOptions = {
  httpOnly: true,
  sameSite: 'none',
  secure: true,
};

const ACCESS_TOKEN_COOKIE_OPTIONS: CookieOptions = {
  ...COOKIE_OPTIONS,
  maxAge: 3600000, // 1 hour
};
const REFRESH_TOKEN_COOKIE_OPTIONS: CookieOptions = {
  ...COOKIE_OPTIONS,
  maxAge: 1209600000, // 14 days
};

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly authService: AuthService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext) {
    if (this.reflector.get<boolean>('skipAuth', context.getHandler())) {
      return true;
    }
    const req = context.switchToHttp().getRequest<Request>();

    // FIXME: skip guard for test
    if (req.headers['x-user-id'] !== undefined) {
      return true;
    }
    const { accessToken, refreshToken } = req.cookies;

    const res = context.switchToHttp().getResponse<Response>();
    if (accessToken && this.verifyAccessToken(req, accessToken)) {
      return true;
    }
    if (
      refreshToken &&
      (await this.verifyRefreshToken(req, res, refreshToken))
    ) {
      return true;
    }
    throw new UnauthorizedException('Unauthorized, Please login again.');
  }

  private verifyAccessToken(req: Request, accessToken: string) {
    const userId = this.authService.verifyAccessToken(accessToken)?.userId;
    if (userId) {
      req.user = { userId: Math.floor(Number(userId)) };
      return true;
    }
    return false;
  }

  private async verifyRefreshToken(
    req: Request,
    res: Response,
    refreshToken: string,
  ) {
    const userId = (await this.authService.verifyRefreshToken(refreshToken))
      ?.userId;
    if (userId) {
      req.user = { userId: Math.floor(Number(userId)) };
      res.cookie(
        'accessToken',
        this.authService.issueAccessToken(userId),
        ACCESS_TOKEN_COOKIE_OPTIONS,
      );
      res.cookie(
        'refreshToken',
        await this.authService.issueRefreshToken(userId),
        REFRESH_TOKEN_COOKIE_OPTIONS,
      );
      return true;
    }
    return false;
  }
}
