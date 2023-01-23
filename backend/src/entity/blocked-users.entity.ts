import { Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';

import { Users } from './users.entity';

export interface BlockedUsersInterface {
  blockerId: number;
  blockedId: number;
}

@Entity()
export class BlockedUsers implements BlockedUsersInterface {
  @PrimaryColumn({
    type: 'integer',
    name: 'blocker_id',
    primaryKeyConstraintName: 'blocked_users_pkey',
  })
  blockerId: number;

  @PrimaryColumn({
    type: 'integer',
    name: 'blocked_id',
    primaryKeyConstraintName: 'blocked_users_pkey',
  })
  blockedId: number;

  @ManyToOne(() => Users)
  @JoinColumn({
    name: 'blocker_id',
    foreignKeyConstraintName: 'blocked_users_blocker_id_fkey',
  })
  blocker: Users;

  @ManyToOne(() => Users)
  @JoinColumn({
    name: 'blocked_id',
    foreignKeyConstraintName: 'blocked_users_blocked_id_fkey',
  })
  blocked: Users;
}
