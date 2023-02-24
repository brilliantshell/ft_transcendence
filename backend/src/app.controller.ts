import {
  Controller,
  Delete,
  Get,
  HttpStatus,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Response } from 'express';
import { Like, Repository } from 'typeorm';

import { AppService } from './app.service';
import { AuthService } from './auth/auth.service';
import { Users } from './entity/users.entity';
import { VerifiedRequest } from './util/type';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly authService: AuthService,
    @InjectRepository(Users)
    private readonly usersRepository: Repository<Users>,
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

  @Get('/search')
  search(@Req() req: VerifiedRequest, @Query('search') search: string) {
    return this.usersRepository.find({
      where: {
        nickname: Like(`${search}%`),
      },
      take: 10,
      select: ['userId', 'nickname', 'isDefaultImage'],
    });
  }
}
