import {
  Check,
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { Users } from './users.entity';

enum AccessMode {
  PUBLIC = 'public',
  PROTECTED = 'protected',
  PRIVATE = 'private',
}

@Entity()
@Check(`"member_cnt" >= 0`)
export class Channels {
  @PrimaryGeneratedColumn({ primaryKeyConstraintName: 'channels_pkey' })
  channel_id: number;

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

  @Column({ type: 'varchar', length: 128, nullable: false })
  channel_name: string;

  @Column({ type: 'integer', nullable: false })
  member_cnt: number;

  @Column({
    type: 'enum',
    enum: ['public', 'protected ', 'private'],
    nullable: false,
  })
  access_mode: AccessMode;

  @Column({ type: 'bytea', nullable: true })
  passwd: string[];

  @UpdateDateColumn({ type: 'timestamptz' })
  modified_at: Date;
}
