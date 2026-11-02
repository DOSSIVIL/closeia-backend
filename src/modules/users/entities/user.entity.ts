import {
  Check, Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, OneToMany,
  PrimaryGeneratedColumn, Relation, UpdateDateColumn,
} from 'typeorm';
import { School } from '../../schools/entities/school.entity';
import { RoleAssignment } from '../../roles/entities/role-assignment.entity';

export enum UserStatus {
  ACTIVE = 'ACTIVE',
  SUSPENDED = 'SUSPENDED',
  INVITED = 'INVITED',
}

@Entity('users')
@Check('email = LOWER(email)')
export class User {
  @PrimaryGeneratedColumn('uuid') id!: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 254 })
  email!: string;

  @Column({ type: 'varchar', length: 100 }) firstName!: string;
  @Column({ type: 'varchar', length: 100 }) lastName!: string;

  /** Hash argon2id, uniquement pour les administrateurs. Jamais chargé par défaut. */
  @Column({ type: 'varchar', length: 255, nullable: true, select: false })
  passwordHash!: string | null;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 64, nullable: true })
  googleSub!: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true }) avatarUrl!: string | null;

  @Column({ type: 'enum', enum: UserStatus, default: UserStatus.ACTIVE })
  status!: UserStatus;

  @Column({ type: 'uuid', nullable: true }) schoolId!: string | null;

  @ManyToOne(() => School, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'schoolId' })
  school!: Relation<School> | null;

  @OneToMany(() => RoleAssignment, (a) => a.user)
  assignments!: Relation<RoleAssignment>[];

  /** Incrémenté pour révoquer tous les jetons de l'utilisateur. */
  @Column({ type: 'int', default: 0 }) tokenVersion!: number;

  @Column({ type: 'int', default: 0 }) failedLoginCount!: number;
  @Column({ type: 'timestamptz', nullable: true }) lockedUntil!: Date | null;
  @Column({ type: 'timestamptz', nullable: true }) lastLoginAt!: Date | null;

  @CreateDateColumn({ type: 'timestamptz' }) createdAt!: Date;
  @UpdateDateColumn({ type: 'timestamptz' }) updatedAt!: Date;
}