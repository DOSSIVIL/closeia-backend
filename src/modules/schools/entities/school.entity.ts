import { Column, CreateDateColumn, Entity, Index, OneToMany, PrimaryGeneratedColumn, Relation, UpdateDateColumn } from 'typeorm';
import { SchoolDomain } from './school-domain.entity';

@Entity('schools')
export class School {
  @PrimaryGeneratedColumn('uuid') id!: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 20 })
  code!: string;

  @Column({ type: 'varchar', length: 200 }) name!: string;
  @Column({ type: 'boolean', default: true }) isActive!: boolean;

  @OneToMany(() => SchoolDomain, (d) => d.school)
  domains!: Relation<SchoolDomain>[];

  @CreateDateColumn({ type: 'timestamptz' }) createdAt!: Date;
  @UpdateDateColumn({ type: 'timestamptz' }) updatedAt!: Date;
}