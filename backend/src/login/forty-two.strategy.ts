import { HttpService } from '@nestjs/axios';
import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-oauth2';
import { catchError } from 'rxjs';
import { AuthService } from 'src/auth/auth.service';

import { ApiConfigService } from '../config/api-config.service';
import { UserId } from '../util/type';

@Injectable()
export class FortyTwoStrategy extends PassportStrategy(Strategy, '42') {
  private readonly logger = new Logger(FortyTwoStrategy.name);
  constructor(
    private readonly apiConfigService: ApiConfigService,
    private readonly httpService: HttpService,
    private readonly authService: AuthService,
  ) {
    super(apiConfigService.oauthConfig);
  }

  async userProfile(
    accessToken: string,
    done: (err?: Error, profile?: any) => void,
  ) {
    this.httpService
      .get('https://api.intra.42.fr/oauth/token/info', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      })
      .pipe(
        catchError((err) => {
          this.logger.error(err);
          throw new InternalServerErrorException(
            'Failed to get user Id from 42 API',
          );
        }),
      )
      .subscribe((response) => {
        console.log(response.data);
        done(null, { userId: response.data['resource_owner_id'] });
      });
  }

  async validate(accessToken: string, refreshToken: string, profile: any) {
    profile.isNew = await this.authService.findUserById(profile.userId);
    console.log(profile);
    return profile;
  }
}
