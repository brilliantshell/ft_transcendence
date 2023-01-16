import { Column, Entity, PrimaryGeneratedColumn, Unique } from 'typeorm';

@Entity()
@Unique(['title'])
export class Achievements {
  @PrimaryGeneratedColumn({
    primaryKeyConstraintName: 'achievements_pkey',
  })
  achievement_id: number;

  @Column({ type: 'varchar', length: 32, nullable: false })
  title: string;

  @Column({ type: 'varchar', length: 256, nullable: false })
  about: string;

  @Column({ type: 'varchar', length: 256, nullable: false })
  image_path: string;
}
