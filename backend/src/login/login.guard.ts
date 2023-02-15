import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';

import { AuthService } from '../auth/auth.service';

@Injectable()
export class LoginGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest<Request>();
    const userId = this.authService.verifyLoginToken(
      req.cookies.loginToken,
    )?.userId;
    if (!userId) {
      throw new UnauthorizedException('Unauthorized, Please login again.');
    }
    req.user = { userId };
    return true;
  }
}
