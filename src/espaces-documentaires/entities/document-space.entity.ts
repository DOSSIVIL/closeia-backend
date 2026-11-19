import {
  Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn,
  type Relation,
} from 'typeorm';
import { School } from '../../modules/schools/entities/school.entity';

export const DEFAULT_SPACE_NAME = 'Général';

/** Espace documentaire : appartient à exactement un établissement, pour toujours. */
@Entity('document_spaces')
@Index('uq_document_space_name', ['schoolId', 'name'], { unique: true })
@Index('uq_document_space_default', ['schoolId'], { unique: true, where: '"isDefault"' })
export class DocumentSpace {
  @PrimaryGeneratedColumn('uuid') id!: string;

  /** Non modifiable après création (également imposé par un déclencheur en base). */
  @Column({ type: 'uuid', update: false })
  schoolId!: string;

  @ManyToOne(() => School, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'schoolId' })
  school!: Relation<School>;

  @Column({ type: 'varchar', length: 150 }) name!: string;
  @Column({ type: 'text', nullable: true }) description!: string | null;

  /** Espace créé avec l'établissement ; un seul par établissement, jamais archivé. */
  @Column({ type: 'boolean', default: false }) isDefault!: boolean;

  /** Archivage logique : l'espace n'est plus proposé mais reste en base. */
  @Column({ type: 'timestamptz', nullable: true }) archivedAt!: Date | null;

  @CreateDateColumn({ type: 'timestamptz' }) createdAt!: Date;
  @UpdateDateColumn({ type: 'timestamptz' }) updatedAt!: Date;
}
