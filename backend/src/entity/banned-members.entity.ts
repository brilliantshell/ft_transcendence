import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { DateTime } from 'luxon';

import { Channels } from './channels.entity';
import { DateTimeTransformer } from './date-time.transformer';
import { Users } from './users.entity';

@Entity()
export class BannedMembers {
  @PrimaryColumn({
    type: 'integer',
    name: 'channel_id',
    primaryKeyConstraintName: 'banned_members_pkey',
  })
  channelId: number;

  @PrimaryColumn({
    type: 'integer',
    name: 'member_id',
    primaryKeyConstraintName: 'banned_members_pkey',
  })
  memberId: number;

  @Column({
    type: 'timestamptz',
    name: 'end_at',
    nullable: false,
    transformer: new DateTimeTransformer(),
  })
  endAt: DateTime;

  @ManyToOne(() => Channels, { onDelete: 'CASCADE' })
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
