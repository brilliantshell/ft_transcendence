import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { Channels } from './channels.entity';
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

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @ManyToOne(() => Channels)
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
