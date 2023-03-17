import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { DateTime } from 'luxon';

import { Channels } from './channels.entity';
import { DateTimeTransformer } from './date-time.transformer';
import { Users } from './users.entity';

@Entity()
export class ChannelMembers {
  @PrimaryColumn({
    type: 'integer',
    name: 'member_id',
    primaryKeyConstraintName: 'channel_members_pkey',
  })
  memberId: number;

  @PrimaryColumn({
    type: 'integer',
    name: 'channel_id',
    primaryKeyConstraintName: 'channel_members_pkey',
  })
  channelId: number;

  @Column({
    type: 'boolean',
    default: false,
    name: 'is_admin',
    nullable: false,
  })
  isAdmin: boolean;

  @Column({
    type: 'timestamptz',
    name: 'mute_end_at',
    nullable: false,
    transformer: new DateTimeTransformer(),
  })
  muteEndAt: DateTime | 'epoch';

  @Column({
    type: 'timestamptz',
    name: 'viewed_at',
    nullable: false,
    transformer: new DateTimeTransformer(),
  })
  viewedAt: DateTime;

  @ManyToOne(() => Users)
  @JoinColumn({
    name: 'member_id',
    foreignKeyConstraintName: 'channel_members_member_id_fkey',
  })
  member: Users;

  @ManyToOne(() => Channels, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'channel_id',
    foreignKeyConstraintName: 'channel_members_channel_id_fkey',
  })
  channel: Channels;
}
