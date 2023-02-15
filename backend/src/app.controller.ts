import { Controller, Delete, Get, Req, Res } from '@nestjs/common';
import { Response } from 'express';

import { AppService } from './app.service';
import { AuthService } from './auth/auth.service';
import { VerifiedRequest } from './util/type';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly authService: AuthService,
  ) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Delete('/logout')
  async logout(@Req() req: VerifiedRequest, @Res() res: Response) {
    await this.authService.clearRefreshTokens(req.user.userId);
    res
      .status(200)
      .cookie('accessToken', '', { expires: new Date(0) })
      .cookie('refreshToken', '', { expires: new Date(0) })
      .end();
  }
}
