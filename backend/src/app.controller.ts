import {
  Controller,
  Delete,
  Get,
  HttpStatus,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Response } from 'express';

import { AppService } from './app.service';
import { AuthService } from './auth/auth.service';
import { MockAuthGuard } from './guard/mock-auth.guard';
import { VerifiedRequest } from './util/type';

@UseGuards(MockAuthGuard)
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
      .status(HttpStatus.NO_CONTENT)
      .cookie('accessToken', '', { expires: new Date(0) })
      .cookie('refreshToken', '', { expires: new Date(0) })
      .end();
  }
}
