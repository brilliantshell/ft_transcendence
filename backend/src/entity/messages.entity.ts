import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { DateTime } from 'luxon';

import { Channels } from './channels.entity';
import { DateTimeTransformer } from './date-time.transformer';
import { Users } from './users.entity';

@Entity()
export class Messages {
  @PrimaryGeneratedColumn({ primaryKeyConstraintName: 'messages_pkey' })
  message_id: number;

  @Column({ type: 'integer', nullable: false })
  channel_id: number;

  @Column({ type: 'integer', nullable: false })
  sender_id: number;

  @Column({ type: 'varchar', length: 4096, nullable: false })
  contents: string;

  @Column({
    type: 'timestamptz',
    transformer: new DateTimeTransformer(),
  })
  created_at: DateTime;

  @ManyToOne(() => Channels, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'channel_id',
    foreignKeyConstraintName: 'messages_channel_id_fkey',
  })
  channel: Channels;

  @ManyToOne(() => Users)
  @JoinColumn({
    name: 'sender_id',
    foreignKeyConstraintName: 'messages_sender_id_fkey',
  })
  sender: Users;
}
