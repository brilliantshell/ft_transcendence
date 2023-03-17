import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';
import { hash } from 'bcrypt';

import { CreateChannelDto, UpdateChannelDto } from '../dto/chats.dto';

@Injectable()
export class ValidateChannelInfoPipe implements PipeTransform {
  async transform(value: CreateChannelDto | UpdateChannelDto) {
    const password = this.validate(value);
    value.password = password === undefined ? null : await hash(password, 10);
    return value;
  }

  private validate(value: CreateChannelDto | UpdateChannelDto) {
    const { accessMode, password } = value;
    if (accessMode === 'protected' && !password) {
      throw new BadRequestException(
        'Password is required for protected channel',
      );
    }
    if (accessMode !== 'protected' && password) {
      throw new BadRequestException(
        'Password is not allowed for public channel',
      );
    }
    return password;
  }
}
