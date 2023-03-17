import { EntityNotFoundError, Repository } from 'typeorm';
import { HttpService } from '@nestjs/axios';
import { InjectRepository } from '@nestjs/typeorm';
import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-oauth2';
import { catchError } from 'rxjs';

import { ApiConfigService } from '../config/api-config.service';
import { AuthService } from '../auth/auth.service';
import { LoginUserInfo } from '../util/type';
import { Users } from '../entity/users.entity';

@Injectable()
export class FortyTwoStrategy extends PassportStrategy(Strategy, '42') {
  private readonly logger = new Logger(FortyTwoStrategy.name);

  constructor(
    private readonly apiConfigService: ApiConfigService,
    private readonly authService: AuthService,
    private readonly httpService: HttpService,
    @InjectRepository(Users)
    private readonly usersRepository: Repository<Users>,
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
        done(null, { userId: response.data['resource_owner_id'] });
      });
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    profile: LoginUserInfo,
  ) {
    profile.isRegistered = await this.authService.findUserById(profile.userId);
    if (!profile.isRegistered) {
      return profile;
    }
    try {
      profile.authEmail = (
        await this.usersRepository.findOneOrFail({
          where: { userId: profile.userId },
          select: ['authEmail'],
        })
      ).authEmail;
    } catch (e) {
      if (!(e instanceof EntityNotFoundError)) {
        this.logger.error(e);
        throw new InternalServerErrorException(
          `Failed to find auth email of user(${profile.userId})`,
        );
      }
    }
    return profile;
  }
}
