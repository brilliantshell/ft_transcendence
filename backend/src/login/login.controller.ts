import { Controller, Get, Req, Res, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Response } from 'express';

import { AuthService } from '../auth/auth.service';
import { SkipAuthGuard } from '../decorator/skip-auth.decorator';
import { VerifiedRequest } from '../util/type';
import { FortyTwoGuard } from './forty-two.guard';

@Controller('login')
export class LoginController {
  constructor(private readonly authService: AuthService) {}
  // @SkipAuthGuard()
  // @UseGuards(AuthGuard('42'))
  // @Get()
  // login() {
  //   return;
  // }

  @SkipAuthGuard()
  @UseGuards(FortyTwoGuard)
  @Get('/return')
  async return(@Req() req: VerifiedRequest, @Res() res: Response) {
    // TODO : redirect to '<frontendURL>/profile
    console.log('controller', req.user);

    res
      .status(302)
      .redirect(`http://localhost:3000/profile/${req.user.userId}`);
  }
}
