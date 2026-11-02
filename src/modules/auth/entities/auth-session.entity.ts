import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import type { Relation } from 'typeorm'; 
import { User } from '../../users/entities/user.entity';

/** Une connexion = une session. Son identifiant est le « jti » du jeton. */
@Entity('auth_sessions')
export class AuthSession {
  @PrimaryGeneratedColumn('uuid') 
  id!: string;

  @Index()
  @Column({ type: 'uuid' })
  userId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user!: Relation<User>; // Maintenant TypeScript sait que c'est un type pur

  /** « web » (portail) ou « mobile ». */
  @Column({ type: 'varchar', length: 10 }) 
  client!: string;

  @Column({ type: 'varchar', length: 255, nullable: true }) 
  userAgent!: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true }) 
  ip!: string | null;

  @Index()
  @Column({ type: 'timestamptz' })
  expiresAt!: Date;

  @Column({ type: 'timestamptz', nullable: true }) 
  revokedAt!: Date | null;

  /** LOGOUT, LOGOUT_ALL… */
  @Column({ type: 'varchar', length: 30, nullable: true }) 
  revokedReason!: string | null;

  @CreateDateColumn({ type: 'timestamptz' }) 
  createdAt!: Date;
}