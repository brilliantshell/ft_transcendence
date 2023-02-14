import { SetMetadata } from '@nestjs/common';

export const SkipAuthGuard = () => SetMetadata('skipAuth', true);
