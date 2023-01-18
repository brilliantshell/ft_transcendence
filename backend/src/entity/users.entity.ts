import { Check, Column, Entity, PrimaryColumn, Unique } from 'typeorm';

@Entity()
@Check(`"ladder" >= 0`)
@Check(`"win_cnt" >= 0`)
@Check(`"loss_cnt" >= 0`)
@Unique(['nickname', 'auth_email'])
export class Users {
  @PrimaryColumn({ type: 'integer', primaryKeyConstraintName: 'users_pkey' })
  user_id: number;

  @Column({ type: 'varchar', length: 16, nullable: false })
  nickname: string;

  @Column({
    type: 'varchar',
    default: 'default.png',
    length: 256,
    nullable: false,
  })
  profile_image: string;

  @Column({ type: 'varchar', length: 320 })
  auth_email: string;

  @Column({ type: 'integer', default: 0, nullable: false })
  ladder: number;

  @Column({ type: 'integer', default: 0, nullable: false })
  win_cnt: number;

  @Column({ type: 'integer', default: 0, nullable: false })
  loss_cnt: number;
}
