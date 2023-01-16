import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { BannedMembers } from '../entity/banned-members.entity';
import { BlockedUsers } from '../entity/blocked-users.entity';
import { ChannelMembers } from '../entity/channel-members.entity';
import { Channels } from '../entity/channels.entity';
import { Messages } from '../entity/messages.entity';
import { Friends } from '../entity/friends.entity';
import { Users } from '../entity/users.entity';

import { UserRelationshipStorage } from './user-relationship.storage';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      BannedMembers,
      BlockedUsers,
      ChannelMembers,
      Channels,
      Friends,
      Messages,
      Users,
    ]),
  ],
  providers: [UserRelationshipStorage],
})
export class UserStatusModule {}
