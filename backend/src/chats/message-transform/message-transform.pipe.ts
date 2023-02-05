import { ArgumentMetadata, Injectable, PipeTransform } from '@nestjs/common';
import { MessageDto } from '../dto/chats.dto';

@Injectable()
export class MessageTransformPipe
  implements PipeTransform<MessageDto, MessageDto>
{
  transform(value: MessageDto, metadata: ArgumentMetadata) {
    if (
      /^\/((role \d{5,6} (admin|member))|((ban|mute) \d{5,6} \d{1,4}))$/.test(
        value.message,
      )
    ) {
      const [command, target, args] = value.message.split(' ');
      // FIXME
      const targetId = parseInt(target, 10);
      value.command = {
        command,
        targetId,
        args,
      };
    }
    return value;
  }
}
