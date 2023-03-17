import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import * as cookieParser from 'cookie-parser';

import { AppModule } from './app.module';
import { JwtAuthIoAdapter } from './auth/jwt-auth.io-adapter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useWebSocketAdapter(new JwtAuthIoAdapter(app));
  process.env.NODE_ENV === 'development' &&
    app.enableCors({
      credentials: true,
      exposedHeaders: 'location',
      origin: 'http://localhost:5173',
    });
  app.setGlobalPrefix('api');
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
