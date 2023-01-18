import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';

import { Users } from './users.entity';

@Entity()
export class Friends {
  @PrimaryColumn({ type: 'integer', primaryKeyConstraintName: 'friends_pkey' })
  sender_id: number;

  @PrimaryColumn({ type: 'integer', primaryKeyConstraintName: 'friends_pkey' })
  receiver_id: number;

  @Column({ type: 'boolean', default: false, nullable: false })
  is_accepted: boolean;

  @ManyToOne(() => Users)
  @JoinColumn({
    name: 'sender_id',
    foreignKeyConstraintName: 'friends_sender_id_fkey',
  })
  sender: Users;

  @ManyToOne(() => Users)
  @JoinColumn({
    name: 'receiver_id',
    foreignKeyConstraintName: 'friends_receiver_id_fkey',
  })
  receiver: Users;
}
