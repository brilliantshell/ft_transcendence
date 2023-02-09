import {
  Check,
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { DateTime } from 'luxon';

import { DateTimeTransformer } from './date-time.transformer';
import { Users } from './users.entity';

@Entity()
@Check(`"user_one_score" >= 0`)
@Check(`"user_two_score" >= 0`)
export class MatchHistory {
  @PrimaryGeneratedColumn({
    primaryKeyConstraintName: 'match_history_pkey',
    name: 'match_id',
  })
  matchId: number;

  @Column({ type: 'integer', name: 'user_one_id', nullable: false })
  userOneId: number;

  @Column({ type: 'integer', name: 'user_two_id', nullable: false })
  userTwoId: number;

  @Column({
    type: 'integer',
    default: 0,
    name: 'user_one_score',
    nullable: false,
  })
  userOneScore: number;

  @Column({
    type: 'integer',
    default: 0,
    name: 'user_two_score',
    nullable: false,
  })
  userTwoScore: number;

  @Column({ type: 'boolean', default: false, name: 'is_rank', nullable: false })
  isRank: boolean;

  @Column({
    type: 'timestamptz',
    name: 'end_at',
    nullable: false,
    transformer: new DateTimeTransformer(),
  })
  endAt: DateTime;

  @ManyToOne(() => Users)
  @JoinColumn({
    name: 'user_one_id',
    foreignKeyConstraintName: 'match_history_user_one_id_fkey',
  })
  userOne: Users;

  @ManyToOne(() => Users)
  @JoinColumn({
    name: 'user_two_id',
    foreignKeyConstraintName: 'match_history_user_two_id_fkey',
  })
  userTwo: Users;
}
