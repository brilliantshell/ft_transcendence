import { HttpService } from '@nestjs/axios';
import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-oauth2';
import { catchError } from 'rxjs';

import { ApiConfigService } from '../config/api-config.service';
import { UserId } from '../util/type';

@Injectable()
export class FortyTwoStrategy extends PassportStrategy(Strategy, '42') {
  private readonly logger = new Logger(FortyTwoStrategy.name);
  constructor(
    private readonly apiConfigService: ApiConfigService,
    private readonly httpService: HttpService,
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

  async validate(
    accessToken: string,
    refreshToken: string,
    profile: { userId: UserId },
  ) {
    /** TODO : find user by userId
     * 유저가 없다면 프사 설정 페이지로 보내서 유저 생성
     * 유저가 있다면 2FA 확인
     *   2FA가 있다면 2FA 확인
     * 이 모든 과정이 끝나면 토큰 발급 후 redirect
     * ...???
     */
    console.log('userId: ', profile);
    return profile;
  }
}
