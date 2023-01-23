import { Check, Column, Entity, PrimaryColumn, Unique } from 'typeorm';

@Entity()
@Check(`"ladder" >= 0`)
@Check(`"win_count" >= 0`)
@Check(`"loss_count" >= 0`)
@Unique(['nickname', 'authEmail'])
export class Users {
  @PrimaryColumn({
    type: 'integer',
    name: 'user_id',
    primaryKeyConstraintName: 'users_pkey',
  })
  userId: number;

  @Column({ type: 'varchar', length: 16, nullable: false })
  nickname: string;

  @Column({
    type: 'varchar',
    default: 'default.png',
    length: 256,
    name: 'profile_image',
    nullable: false,
  })
  profileImage: string;

  @Column({ type: 'varchar', length: 320, name: 'auth_email' })
  authEmail: string;

  @Column({ type: 'integer', default: 0, nullable: false })
  ladder: number;

  @Column({ type: 'integer', default: 0, name: 'win_count', nullable: false })
  winCount: number;

  @Column({ type: 'integer', default: 0, name: 'loss_count', nullable: false })
  lossCount: number;
}
