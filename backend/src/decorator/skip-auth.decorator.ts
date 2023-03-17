import { SetMetadata } from '@nestjs/common';

export const SkipJwtAuthGuard = () => SetMetadata('skipAuth', true);
