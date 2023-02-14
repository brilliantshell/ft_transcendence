import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';

@Injectable()
export class MockAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    if (req.user !== undefined) {
      return true;
    }
    const userId = req.headers['x-user-id'];
    if (!userId || isNaN(userId)) {
      return false;
    }
    req.user = { userId: Math.floor(Number(userId)) };
    return true;
  }
}
