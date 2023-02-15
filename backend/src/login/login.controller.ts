import {
  Body,
  Controller,
  Get,
  Put,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';

import {
  ACCESS_TOKEN_COOKIE_OPTIONS,
  REFRESH_TOKEN_COOKIE_OPTIONS,
} from '../util/constant/cookie-constant';
import { AuthService } from '../auth/auth.service';
import { FortyTwoGuard } from './forty-two.guard';
import { LoginGuard } from './login.guard';
import { LoginRequest } from '../util/type';
import { LoginService } from './login.service';
import { NicknameDto } from '../profile/dto/profile.dto';
import { SkipAuthGuard } from '../decorator/skip-auth.decorator';
import { multerOptions } from '../profile/option/profile.upload-options';

@Controller('login')
export class LoginController {
  constructor(
    private readonly authService: AuthService,
    private readonly loginService: LoginService,
  ) {}

  @SkipAuthGuard()
  @UseGuards(FortyTwoGuard)
  @Get('/return')
  async return(@Req() req: LoginRequest, @Res() res: Response) {
    const { isRegistered, authEmail } = req.user;
    res
      .status(303)
      .redirect(
        `http://localhost:5173/${
          !isRegistered ? 'sign-up' : authEmail ? '2fa' : 'profile'
        }`,
      );
  }

  @SkipAuthGuard()
  @UseGuards(LoginGuard)
  @UseInterceptors(FileInterceptor('profileImage', multerOptions))
  @Put('/user-info')
  async createUserInfo(
    @Req() req: LoginRequest,
    @Res() res: Response,
    @Body() nicknameDto: NicknameDto,
    @UploadedFile() file: Express.Multer.File,
  ) {
    const { userId } = req.user;
    await this.loginService.createUserInfo(
      userId,
      nicknameDto.nickname,
      file === undefined,
    );
    const { accessToken, refreshToken } = await this.authService.issueTokens(
      userId,
    );
    res
      .status(200)
      .cookie('accessToken', accessToken, ACCESS_TOKEN_COOKIE_OPTIONS)
      .cookie('refreshToken', refreshToken, REFRESH_TOKEN_COOKIE_OPTIONS)
      .cookie('loginToken', '', { expires: new Date(0) })
      .end();
  }
}
