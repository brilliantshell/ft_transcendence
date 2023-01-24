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

export enum AccessMode {
  PUBLIC = 'public',
  PROTECTED = 'protected',
  PRIVATE = 'private',
}

@Entity()
@Check(`"member_count" >= 0`)
export class Channels {
  @PrimaryGeneratedColumn({
    name: 'channel_id',
    primaryKeyConstraintName: 'channels_pkey',
  })
  channelId: number;

  @Column({ type: 'integer', name: 'owner_id', nullable: false })
  ownerId: number;

  @Column({
    type: 'integer',
    default: null,
    name: 'dm_peer_id',
    nullable: true,
  })
  dmPeerId: number | null;

  @Column({ type: 'varchar', length: 128, nullable: false })
  name: string;

  @Column({
    type: 'integer',
    default: 1,
    name: 'member_count',
    nullable: false,
  })
  memberCount: number;

  @Column({
    type: 'enum',
    enum: AccessMode,
    name: 'access_mode',
    nullable: false,
  })
  accessMode: AccessMode;

  @Column({ type: 'bytea', nullable: true })
  password: string | null;

  @Column({
    type: 'timestamptz',
    name: 'modified_at',
    transformer: new DateTimeTransformer(),
  })
  modifiedAt: DateTime;

  @ManyToOne(() => Users)
  @JoinColumn({
    name: 'owner_id',
    foreignKeyConstraintName: 'channels_owner_id_fkey',
  })
  owner: Users;

  @ManyToOne(() => Users)
  @JoinColumn({
    name: 'dm_peer_id',
    foreignKeyConstraintName: 'channels_dm_peer_id_fkey',
  })
  dmPeer: Users;
}
