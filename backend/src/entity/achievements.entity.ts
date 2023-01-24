import { Column, Entity, PrimaryGeneratedColumn, Unique } from 'typeorm';

@Entity()
@Unique(['title'])
export class Achievements {
  @PrimaryGeneratedColumn({
    primaryKeyConstraintName: 'achievements_pkey',
    name: 'achievement_id',
  })
  achievementId: number;

  @Column({ type: 'varchar', length: 32, nullable: false })
  title: string;

  @Column({ type: 'varchar', length: 256, nullable: false })
  about: string;

  @Column({ type: 'varchar', length: 256, name: 'image_path', nullable: false })
  imagePath: string;
}
