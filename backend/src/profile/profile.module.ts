import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Achievements } from '../entity/achievements.entity';
import { Achievers } from '../entity/achievers.entity';
import { ChannelMembers } from '../entity/channel-members.entity';
import { Friends } from '../entity/friends.entity';
import { MatchHistory } from '../entity/match-history.entity';
import { ProfileController } from './profile.controller';
import { ProfileService } from './profile.service';
import { Users } from '../entity/users.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Achievements,
      Achievers,
      ChannelMembers,
      Friends,
      MatchHistory,
      Users,
    ]),
  ],
  controllers: [ProfileController],
  providers: [ProfileService],
})
export class ProfileModule {}
