import {
  ArgumentMetadata,
  BadRequestException,
  Injectable,
  PipeTransform,
} from '@nestjs/common';
import { hash } from 'bcrypt';
import { CreateChannelDto } from '../dto/chats.dto';

@Injectable()
export class ValidateNewChannelPipe implements PipeTransform {
  async transform(value: CreateChannelDto) {
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
    value.password = password === undefined ? null : await hash(password, 10);

    return value;
  }
}
