import { Check, Column, Entity, PrimaryColumn } from 'typeorm';

@Entity()
@Check(`"ladder" >= 0`)
@Check(`"win_count" >= 0`)
@Check(`"loss_count" >= 0`)
export class Users {
  @PrimaryColumn({
    type: 'integer',
    name: 'user_id',
    primaryKeyConstraintName: 'users_pkey',
  })
  userId: number;

  @Column({ type: 'varchar', length: 16, unique: true, nullable: false })
  nickname: string;

  @Column({
    type: 'varchar',
    length: 256,
    name: 'profile_image',
    nullable: true,
  })
  profileImage: string;

  @Column({
    type: 'varchar',
    length: 320,
    unique: true,
    name: 'auth_email',
    nullable: true,
  })
  authEmail: string;

  @Column({ type: 'integer', default: 0, nullable: false })
  ladder: number;

  @Column({ type: 'integer', default: 0, name: 'win_count', nullable: false })
  winCount: number;

  @Column({ type: 'integer', default: 0, name: 'loss_count', nullable: false })
  lossCount: number;
}
