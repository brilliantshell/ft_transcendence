import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import * as cookieParser from 'cookie-parser';

import { AppModule } from './app.module';
import { JwtAuthIoAdapter } from './auth/jwt-auth.io-adapter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  process.env.NODE_ENV === 'production'
    ? app.useWebSocketAdapter(new JwtAuthIoAdapter(app))
    : app.enableCors({
        credentials: true,
        exposedHeaders: 'location',
        origin: 'http://localhost:5173',
      });
  app.use(cookieParser());
  app.useGlobalPipes(
    new ValidationPipe({
      forbidNonWhitelisted: true,
      transform: true,
      whitelist: true,
    }),
  );
  await app.listen(3000);
}
bootstrap();
