import { Injectable } from '@nestjs/common';

import { ActivityManager } from '../user-status/activity.manager';
import { ChannelStorage } from '../user-status/channel.storage';
import { UserRelationshipStorage } from '../user-status/user-relationship.storage';
import { UserId } from '../util/type';
import { ChatsGateway } from './chats.gateway';

@Injectable()
export class ChatsService {
  constructor(
    private readonly activityManager: ActivityManager,
    private readonly channelStorage: ChannelStorage,
    private readonly chatsGateway: ChatsGateway,
    private readonly userRelationshipStorage: UserRelationshipStorage,
  ) {}

  findAllChannels(userId: UserId) {
    const joinedChannels = Array.from(this.channelStorage.getUser(userId)).sort(
      (a, b) =>
        this.channelStorage.getChannel(a[0]).modifiedAt.valueOf() -
        this.channelStorage.getChannel(b[0]).modifiedAt.valueOf(),
    );
  }
}
