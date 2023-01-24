import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';

import { Users } from './users.entity';

@Entity()
export class Friends {
  @PrimaryColumn({
    type: 'integer',
    name: 'sender_id',
    primaryKeyConstraintName: 'friends_pkey',
  })
  senderId: number;

  @PrimaryColumn({
    type: 'integer',
    name: 'receiver_id',
    primaryKeyConstraintName: 'friends_pkey',
  })
  receiverId: number;

  @Column({
    type: 'boolean',
    default: false,
    name: 'is_accepted',
    nullable: false,
  })
  isAccepted: boolean;

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
