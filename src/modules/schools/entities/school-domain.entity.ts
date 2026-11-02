import { Check, Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, type Relation } from 'typeorm';
import { School } from './school.entity';

@Entity('school_domains')
@Check('domain = LOWER(domain)')
export class SchoolDomain {
  @PrimaryGeneratedColumn('uuid') id!: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 190 })
  domain!: string;

  @Column({ type: 'uuid' }) schoolId!: string;

  @ManyToOne(() => School, (s) => s.domains, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'schoolId' })
  school!: Relation<School>;
}