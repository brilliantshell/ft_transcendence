import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { DateTime } from 'luxon';

import { Channels } from './channels.entity';
import { DateTimeTransformer } from './date-time.transformer';
import { Users } from './users.entity';

@Entity()
export class BannedMembers {
  @PrimaryColumn({
    type: 'integer',
    primaryKeyConstraintName: 'banned_members_pkey',
  })
  channel_id: number;

  @PrimaryColumn({
    type: 'integer',
    primaryKeyConstraintName: 'banned_members_pkey',
  })
  member_id: number;

  @Column({
    type: 'timestamptz',
    nullable: false,
    transformer: new DateTimeTransformer(),
  })
  end_time: DateTime;

  @ManyToOne(() => Channels)
  @JoinColumn({
    name: 'channel_id',
    foreignKeyConstraintName: 'banned_members_channel_id_fkey',
  })
  channel: Channels;

  @ManyToOne(() => Users)
  @JoinColumn({
    name: 'member_id',
    foreignKeyConstraintName: 'banned_members_member_id_fkey',
  })
  member: Users;
}
