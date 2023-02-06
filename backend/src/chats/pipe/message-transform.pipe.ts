import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  PipeTransform,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { MessageDto } from '../dto/chats.dto';
import { Users } from '../../entity/users.entity';

const COMMAND_REGEX =
  /^\/((role [a-z|A-Z]{1,16} (admin|member))|((ban|mute) [a-z|A-Z]{1,16} \d{1,4}))$/;

@Injectable()
export class MessageTransformPipe implements PipeTransform {
  private readonly logger = new Logger(MessageTransformPipe.name);

  constructor(
    @InjectRepository(Users)
    private readonly usersRepository: Repository<Users>,
  ) {}

  async transform(value: MessageDto) {
    if (!value.message.startsWith('/')) {
      return value;
    }
    if (COMMAND_REGEX.test(value.message) === false) {
      throw new BadRequestException('Invalid command');
    }
    return await this.transformMessage(value);
  }

  private async transformMessage(value: MessageDto) {
    const [kind, targetNickname, arg] = value.message.split(' ');
    let targetId: number;
    try {
      targetId = (
        await this.usersRepository.findOne({
          where: { nickname: targetNickname },
          select: ['userId'],
        })
      ).userId;
    } catch (e) {
      this.logger.error(e);
      new InternalServerErrorException('Failed to find the user');
    }
    if (targetId === undefined) {
      throw new NotFoundException("The user doesn't exist");
    }
    value.command = [kind.slice(1), targetId, arg];
    return value;
  }
}
