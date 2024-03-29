import { Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';

import { Achievements } from './achievements.entity';
import { Users } from './users.entity';

@Entity()
export class Achievers {
  @PrimaryColumn({
    type: 'integer',
    name: 'user_id',
    primaryKeyConstraintName: 'achievers_pkey',
  })
  userId: number;

  @PrimaryColumn({
    type: 'integer',
    name: 'achievement_id',
    primaryKeyConstraintName: 'achievers_pkey',
  })
  achievementId: number;

  @ManyToOne(() => Users)
  @JoinColumn({
    name: 'user_id',
    foreignKeyConstraintName: 'achievers_user_id_fkey',
  })
  user: Users;

  @ManyToOne(() => Achievements)
  @JoinColumn({
    name: 'achievement_id',
    foreignKeyConstraintName: 'achievers_achievement_id_fkey',
  })
  achievement: Achievements;
}
