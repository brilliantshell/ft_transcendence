import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request, Response } from 'express';

import {
  ACCESS_TOKEN_COOKIE_OPTIONS,
  REFRESH_TOKEN_COOKIE_OPTIONS,
} from '../util/constant/cookie-constant';
import { AuthService } from './auth.service';

@Injectable()
export class JwtAuthGuard implements CanActivate {
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
      req.user = { userId };
      const { accessToken, refreshToken } = await this.authService.issueTokens(
        userId,
      );
      res.cookie('accessToken', accessToken, ACCESS_TOKEN_COOKIE_OPTIONS);
      res.cookie('refreshToken', refreshToken, REFRESH_TOKEN_COOKIE_OPTIONS);
      return true;
    }
    return false;
  }
}
