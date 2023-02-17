import {
  Body,
  Controller,
  Get,
  Post,
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
import { LoginRequest, VerifiedRequest } from '../util/type';
import { LoginService } from './login.service';
import { NicknameDto } from '../profile/dto/profile.dto';
import { SkipJwtAuthGuard } from '../decorator/skip-auth.decorator';
import { multerOptions } from '../profile/option/profile.upload-options';

const URL = 'http://localhost:5173/';

@Controller('login')
export class LoginController {
  constructor(
    private readonly authService: AuthService,
    private readonly loginService: LoginService,
  ) {}

  @SkipJwtAuthGuard()
  @UseGuards(FortyTwoGuard)
  @Get('/return')
  async return(@Req() req: LoginRequest, @Res() res: Response) {
    const { isRegistered, authEmail, userId } = req.user;
    res
      .status(303)
      .redirect(
        `${URL}${
          !isRegistered ? 'sign-up' : authEmail ? '2fa' : 'profile/' + userId
        }`,
      );
  }

  @SkipJwtAuthGuard()
  @UseGuards(LoginGuard)
  @UseInterceptors(FileInterceptor('profileImage', multerOptions))
  @Post('/user-info')
  async createUserInfo(
    @Req() req: VerifiedRequest,
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
      .status(201)
      .cookie('accessToken', accessToken, ACCESS_TOKEN_COOKIE_OPTIONS)
      .cookie('refreshToken', refreshToken, REFRESH_TOKEN_COOKIE_OPTIONS)
      .cookie('restrictedAccessToken', '', { expires: new Date(0) })
      .end();
  }

  @SkipJwtAuthGuard()
  @UseGuards(LoginGuard)
  @Post('/2fa')
  async verifyTwoFactorAuth(
    @Req() req: VerifiedRequest,
    @Res() res: Response,
    @Body('authCode') authCode: string,
  ) {
    const { userId } = req.user;
    await this.authService.verifyTwoFactorCode(userId, authCode);
    const { accessToken, refreshToken } = await this.authService.issueTokens(
      userId,
    );
    res
      .status(303)
      .cookie('accessToken', accessToken, ACCESS_TOKEN_COOKIE_OPTIONS)
      .cookie('refreshToken', refreshToken, REFRESH_TOKEN_COOKIE_OPTIONS)
      .cookie('restrictedAccessToken', '', { expires: new Date(0) })
      .redirect(URL + 'profile/' + userId);
  }
}
