import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';

@Injectable()
export class MockAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    if (req.user !== undefined || process.env.NODE_ENV === 'production') {
      return true;
    }
    const userId = req.headers['x-user-id'];
    if (!userId || isNaN(userId)) {
      throw new UnauthorizedException(
        'x-user-id header is required in Dev mode',
      );
    }
    req.user = { userId: Math.floor(Number(userId)) };
    return true;
  }
}
