import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ActivityGateway } from './activity.gateway';
import { ActivityManager } from './activity.manager';
import { BannedMembers } from '../entity/banned-members.entity';
import { BlockedUsers } from '../entity/blocked-users.entity';
import { ChannelMembers } from '../entity/channel-members.entity';
import { ChannelStorage } from './channel.storage';
import { Channels } from '../entity/channels.entity';
import { ChatsModule } from '../chats/chats.module';
import { Friends } from '../entity/friends.entity';
import { GameModule } from '../game/game.module';
import { MatchHistory } from '../entity/match-history.entity';
import { Messages } from '../entity/messages.entity';
import { UserRelationshipStorage } from './user-relationship.storage';
import { UserSocketStorage } from './user-socket.storage';
import { Users } from '../entity/users.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      BannedMembers,
      BlockedUsers,
      ChannelMembers,
      Channels,
      Friends,
      MatchHistory,
      Messages,
      Users,
    ]),
    forwardRef(() => ChatsModule),
    GameModule,
  ],
  providers: [
    ActivityGateway,
    ActivityManager,
    ChannelStorage,
    UserRelationshipStorage,
    UserSocketStorage,
  ],
  exports: [
    ActivityGateway,
    ActivityManager,
    ChannelStorage,
    UserRelationshipStorage,
    UserSocketStorage,
  ],
})
export class UserStatusModule {}
