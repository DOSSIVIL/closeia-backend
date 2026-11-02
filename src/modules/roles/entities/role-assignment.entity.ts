import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, type Relation } from 'typeorm';
import { Role } from './role.entity';
import { User } from '../../users/entities/user.entity';
import { School } from '../../schools/entities/school.entity';

@Entity('role_assignments')
@Index('uq_assignment_scope', ['userId', 'roleId', 'schoolScope'], { unique: true })
export class RoleAssignment {
  @PrimaryGeneratedColumn('uuid') id!: string;

  @Column({ type: 'uuid' }) userId!: string;
  @Column({ type: 'uuid' }) roleId!: string;
  @Column({ type: 'uuid', nullable: true }) schoolId!: string | null;

  @Column({
    type: 'varchar',
    length: 36,
    asExpression: `COALESCE("schoolId"::text, '')`,
    generatedType: 'STORED',
  })
  schoolScope!: string;

  @ManyToOne(() => User, (u) => u.assignments, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user!: Relation<User>;

  @ManyToOne(() => Role, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'roleId' })
  role!: Relation<Role>;

  @ManyToOne(() => School, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'schoolId' })
  school!: Relation<School> | null;

  @CreateDateColumn({ type: 'timestamptz' }) createdAt!: Date;
}