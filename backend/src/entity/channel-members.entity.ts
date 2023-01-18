import { Entity, PrimaryColumn, ManyToOne, JoinColumn, Column } from 'typeorm';

import { Users } from './users.entity';
import { Channels } from './channels.entity';

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
    default: '-infinity',
    nullable: false,
  })
  mute_end_time: Date;

  @Column({
    type: 'timestamptz',
    default: () => 'CURRENT_TIMESTAMP',
    nullable: false,
  })
  viewed_at: Date;

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
  channel: Users;
}
