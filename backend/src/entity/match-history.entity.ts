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
  @PrimaryGeneratedColumn({ primaryKeyConstraintName: 'match_history_pkey' })
  match_id: number;

  @Column({ type: 'integer', nullable: false })
  user_one_id: number;

  @Column({ type: 'integer', nullable: false })
  user_two_id: number;

  @Column({ type: 'integer', default: 0, nullable: false })
  user_one_score: number;

  @Column({ type: 'integer', default: 0, nullable: false })
  user_two_score: number;

  @Column({ type: 'boolean', default: false, nullable: false })
  is_rank: boolean;

  @Column({
    type: 'timestamptz',
    nullable: false,
    transformer: new DateTimeTransformer(),
  })
  end_at: DateTime;

  @ManyToOne(() => Users)
  @JoinColumn({
    name: 'user_one_id',
    foreignKeyConstraintName: 'match_history_user_one_id_fkey',
  })
  user_one: Users;

  @ManyToOne(() => Users)
  @JoinColumn({
    name: 'user_two_id',
    foreignKeyConstraintName: 'match_history_user_two_id_fkey',
  })
  user_two: Users;
}
