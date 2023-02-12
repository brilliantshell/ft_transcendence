import { ConfigService } from '@nestjs/config';
import { Injectable } from '@nestjs/common';
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
}
