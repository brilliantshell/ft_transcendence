import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { DateTime } from 'luxon';

import { Channels } from './channels.entity';
import { DateTimeTransformer } from './date-time.transformer';
import { Users } from './users.entity';

@Entity()
export class ChannelMembers {
  @PrimaryColumn({
    type: 'integer',
    primaryKeyConstraintName: 'channel_members_pkey',
  })
  member_id: number;

  @PrimaryColumn({
    type: 'integer',
    primaryKeyConstraintName: 'channel_members_pkey',
  })
  channel_id: number;

  @Column({ type: 'boolean', default: false, nullable: false })
  is_admin: boolean;

  @Column({
    type: 'timestamptz',
    nullable: false,
    transformer: new DateTimeTransformer(),
  })
  mute_end_time: DateTime | 'epoch';

  @Column({
    type: 'timestamptz',
    nullable: false,
    transformer: new DateTimeTransformer(),
  })
  viewed_at: DateTime;

  @ManyToOne(() => Users)
  @JoinColumn({
    name: 'member_id',
    foreignKeyConstraintName: 'channel_members_member_id_fkey',
  })
  member: Users;

  @ManyToOne(() => Channels)
  @JoinColumn({
    name: 'channel_id',
    foreignKeyConstraintName: 'channel_members_channel_id_fkey',
  })
  channel: Channels;
}
