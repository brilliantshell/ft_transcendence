import { INestApplication } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { Server, ServerOptions } from 'socket.io';

import {
  ACCESS_TOKEN_COOKIE_OPTIONS,
  REFRESH_TOKEN_COOKIE_OPTIONS,
} from '../util/constant/cookie-constant';
import { AuthService } from './auth.service';
import { CookieOptions } from 'express';
import { VerifiedWsRequest } from '../util/type';

export class JwtAuthIoAdapter extends IoAdapter {
  private authService: AuthService;

  constructor(private app: INestApplication) {
    super(app);
    this.authService = this.app.get(AuthService);
  }

  createIOServer(port: number, options?: ServerOptions) {
    options.allowRequest = this.allowRequest;
    const server: Server = super.createIOServer(port, options);
    server.engine.on('initial_headers', this.setCookies);
    return server;
  }

  private allowRequest = async (
    req: VerifiedWsRequest,
    cb: (err: string | null, success: boolean) => void,
  ) => {
    const { accessToken, refreshToken } = this.findTokensFromCookie(
      req.headers.cookie?.split('; '),
    );
    req.user = await this.verifyUser(accessToken, refreshToken);
    if (req.user) {
      cb(null, true);
    } else {
      cb('Unauthorized', false);
    }
  };

  private async verifyUser(accessToken: string, refreshToken: string) {
    let userId =
      accessToken && this.authService.verifyAccessToken(accessToken)?.userId;
    if (userId) {
      return { userId };
    }
    userId =
      refreshToken &&
      (await this.authService.verifyRefreshToken(refreshToken))?.userId;
    if (userId) {
      const newTokens = await this.authService.issueTokens(userId);
      return { userId, ...newTokens };
    }
    return null;
  }

  private findTokensFromCookie(cookies: string[]) {
    if (!cookies) {
      return {};
    }
    const accessToken = cookies
      .find((row) => row.startsWith('accessToken='))
      ?.split('=')[1];
    const refreshToken = cookies
      .find((row) => row.startsWith('refreshToken='))
      ?.split('=')[1];
    return { accessToken, refreshToken };
  }

  private setCookies = (headers: string[], req: VerifiedWsRequest) => {
    if (req.user.accessToken) {
      headers['set-cookie'] = [
        this.setCookieValue(
          `accessToken=${req.user.accessToken}`,
          ACCESS_TOKEN_COOKIE_OPTIONS,
        ),
        this.setCookieValue(
          `refreshToken=${req.user.refreshToken}`,
          REFRESH_TOKEN_COOKIE_OPTIONS,
        ),
      ];
    }
  };

  private setCookieValue(value: string, option: CookieOptions) {
    const { httpOnly, sameSite, secure, maxAge } = option;
    return `${value}; Path=/${httpOnly && '; HttpOnly'}; SameSite=${sameSite}${
      secure ? '; Secure' : ''
    }; Max-Age=${maxAge / 1000}`;
  }
}
