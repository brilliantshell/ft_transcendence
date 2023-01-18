import { Entity, PrimaryColumn, ManyToOne, JoinColumn } from 'typeorm';

import { Achievements } from './achievements.entity';
import { Users } from './users.entity';

@Entity()
export class Achievers {
  @PrimaryColumn({
    type: 'integer',
    primaryKeyConstraintName: 'achievers_pkey',
  })
  user_id: number;

  @PrimaryColumn({
    type: 'integer',
    primaryKeyConstraintName: 'achievers_pkey',
  })
  achievement_id: number;

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
