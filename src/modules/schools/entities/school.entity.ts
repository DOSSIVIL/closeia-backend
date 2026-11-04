import { Column, CreateDateColumn, Entity, Index, OneToMany, PrimaryGeneratedColumn, Relation, UpdateDateColumn } from 'typeorm';
import { SchoolDomain } from './school-domain.entity';

@Entity('schools')
export class School {
  @PrimaryGeneratedColumn('uuid') id!: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 20 })
  code!: string;

  @Column({ type: 'varchar', length: 200 }) name!: string;
  @Column({ type: 'text', nullable: true }) description!: string | null;
  @Column({ type: 'varchar', length: 255, nullable: true }) adresse!: string | null;
  @Column({ type: 'varchar', length: 100, nullable: true }) ville!: string | null;
  @Column({ type: 'varchar', length: 30, nullable: true }) telephone!: string | null;
  @Column({ name: 'email_contact', type: 'varchar', length: 255, nullable: true })
  emailContact!: string | null;
  @Column({ name: 'site_web', type: 'varchar', length: 255, nullable: true })
  siteWeb!: string | null;
  @Column({ name: 'logo_key', type: 'varchar', length: 255, nullable: true })
  logoKey!: string | null;
  @Column({ type: 'boolean', default: true }) isActive!: boolean;

  @OneToMany(() => SchoolDomain, (d) => d.school)
  domains!: Relation<SchoolDomain>[];

  @CreateDateColumn({ type: 'timestamptz' }) createdAt!: Date;
  @UpdateDateColumn({ type: 'timestamptz' }) updatedAt!: Date;
}