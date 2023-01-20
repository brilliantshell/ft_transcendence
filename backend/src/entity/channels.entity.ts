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
@Check(`"member_cnt" >= 0`)
export class Channels {
  @PrimaryGeneratedColumn({ primaryKeyConstraintName: 'channels_pkey' })
  channel_id: number;

  @Column({ type: 'integer', nullable: false })
  owner_id: number;

  @Column({ type: 'integer', nullable: true })
  dm_peer_id: number | null;

  @Column({ type: 'varchar', length: 128, nullable: false })
  name: string;

  @Column({ type: 'integer', default: 1, nullable: false })
  member_cnt: number;

  @Column({
    type: 'enum',
    enum: AccessMode,
    nullable: false,
  })
  access_mode: AccessMode;

  @Column({ type: 'bytea', nullable: true })
  password: string | null;

  @Column({
    type: 'timestamptz',
    transformer: new DateTimeTransformer(),
  })
  modified_at: DateTime;

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
  dm_peer: Users;
}
