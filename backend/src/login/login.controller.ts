import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { VerifiedRequest } from 'src/util/type';

@Controller('login')
export class LoginController {
  @UseGuards(AuthGuard('42'))
  @Get('return')
  login(@Req() req: VerifiedRequest) {
    // TODO : redirect to '<frontendURL>/profile
    console.log(req.user);
    console.log('redirect');
  }
}
