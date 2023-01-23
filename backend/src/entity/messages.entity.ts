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
  @PrimaryGeneratedColumn({
    primaryKeyConstraintName: 'messages_pkey',
    name: 'message_id',
  })
  messageId: number;

  @Column({ type: 'integer', name: 'channel_id', nullable: false })
  channelId: number;

  @Column({ type: 'integer', name: 'sender_id', nullable: false })
  senderId: number;

  @Column({ type: 'varchar', length: 4096, nullable: false })
  contents: string;

  @Column({
    type: 'timestamptz',
    name: 'created_at',
    transformer: new DateTimeTransformer(),
  })
  createdAt: DateTime;

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
