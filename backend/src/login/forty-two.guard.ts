import {
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AuthService } from '../auth/auth.service';

@Injectable()
export class FortyTwoGuard extends AuthGuard('42') {
  constructor(private readonly authService: AuthService) {
    super();
  }
  // execute after canActivate
  // async handleRequest(
  //   err: any,
  //   user: any,
  //   info: any,
  //   context: ExecutionContext,
  // ): Promise<{ userId: number }> {
  //   if (err || !user) {
  //     throw err || new UnauthorizedException('Failed to login with 42');
  //   }
  //   await this.authService.findUserById(user.userId);
  //   return user;
  // }
}
