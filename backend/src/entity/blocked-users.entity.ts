import { Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';

import { Users } from './users.entity';

export interface BlockedUsersInterface {
  blocker_id: number;
  blocked_id: number;
}

@Entity()
export class BlockedUsers implements BlockedUsersInterface {
  @PrimaryColumn({
    type: 'integer',
    primaryKeyConstraintName: 'blocked_users_pkey',
  })
  blocker_id: number;

  @PrimaryColumn({
    type: 'integer',
    primaryKeyConstraintName: 'blocked_users_pkey',
  })
  blocked_id: number;

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
