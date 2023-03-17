import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity()
@Index(['id', 'title', 'about'], { unique: true })
export class Achievements {
  @PrimaryGeneratedColumn({
    primaryKeyConstraintName: 'achievements_pkey',
    name: 'achievement_id',
  })
  id: number;

  @Column({ type: 'varchar', length: 32, nullable: false })
  title: string;

  @Column({ type: 'varchar', length: 256, nullable: false })
  about: string;
}
