import { ConfigService } from '@nestjs/config';
import { Injectable } from '@nestjs/common';
import { MailerOptions } from '@nestjs-modules/mailer';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';

@Injectable()
export class ApiConfigService {
  constructor(private readonly configService: ConfigService) {}

  get postgresConfig(): TypeOrmModuleOptions {
    return {
      type: 'postgres',
      host: this.configService.get('DB_HOST'),
      port: this.configService.get('DB_PORT'),
      username: this.configService.get('DB_USER'),
      password: this.configService.get('DB_PASSWORD'),
      database: this.configService.get('DB_NAME'),
      autoLoadEntities: true,
    };
  }

  get oauthConfig() {
    return {
      authorizationURL: 'https://api.intra.42.fr/oauth/authorize',
      tokenURL: 'https://api.intra.42.fr/oauth/token',
      clientID: this.configService.get('OAUTH_CLIENT_ID'),
      clientSecret: this.configService.get('OAUTH_CLIENT_SECRET'),
      callbackURL: this.configService.get('OAUTH_CALLBACK_URL'),
    };
  }

  get jwtAccessSecret() {
    return {
      secret: this.configService.get('JWT_ACCESS_SECRET'),
    };
  }

  get jwtAccessConfig() {
    return {
      ...this.jwtAccessSecret,
      expiresIn: '1h',
    };
  }

  get jwtRefreshSecret() {
    return {
      secret: this.configService.get('JWT_REFRESH_SECRET'),
    };
  }

  get jwtRefreshConfig() {
    return {
      ...this.jwtRefreshSecret,
      expiresIn: '14d',
    };
  }

  get jwtRestrictedAccessSecret() {
    return {
      secret: this.configService.get('JWT_RESTRICTED_ACCESS_SECRET'),
    };
  }

  get jwtRestrictedAccessConfig() {
    return {
      ...this.jwtRestrictedAccessSecret,
      expiresIn: '15m',
    };
  }

  get mailerConfig(): MailerOptions {
    return {
      transport: {
        host: 'smtp.gmail.com',
        port: 465,
        secure: true,
        auth: {
          user: this.configService.get('MAILER_USER'),
          pass: this.configService.get('MAILER_SECRET'),
        },
      },
      defaults: {
        from: '"no-reply" <no-reply@no-reply.com>',
      },
    };
  }
}
