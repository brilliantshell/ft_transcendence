import { UsePipes, ValidationPipe } from '@nestjs/common';
import {
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
} from '@nestjs/websockets';

import { ActivityManager } from './activity.manager';
import { CurrentUiDto } from './dto/current-ui.dto';

@UsePipes(
  new ValidationPipe({
    forbidNonWhitelisted: true,
    transform: true,
    whitelist: true,
  }),
)
@WebSocketGateway()
export class ActivityGateway {
  constructor(private activityManager: ActivityManager) {}

  @SubscribeMessage('currentUi')
  handleCurrentUi(@MessageBody() { userId, ui }: CurrentUiDto) {
    this.activityManager.setActivity(userId, ui);
  }
}
