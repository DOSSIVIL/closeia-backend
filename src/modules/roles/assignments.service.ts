import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, QueryFailedError, Repository } from 'typeorm';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { School } from '../schools/entities/school.entity';
import { User } from '../users/entities/user.entity';
import { RoleAssignment } from './entities/role-assignment.entity';
import { Role } from './entities/role.entity';
import { DocumentScope, RoleCode } from './roles.constants';
import { CreateAssignmentDto } from './dto/create-assignment.dto';
import { QueryAssignmentsDto } from './dto/query-assignments.dto';

@Injectable()
export class AssignmentsService {
  constructor(
    @InjectRepository(RoleAssignment)
    private readonly assignments: Repository<RoleAssignment>,
    @InjectRepository(Role)
    private readonly roles: Repository<Role>,
    @InjectRepository(User)
    private readonly users: Repository<User>,
    @InjectRepository(School)
    private readonly schools: Repository<School>,
  ) {}

  async listRoles(actor: AuthenticatedUser) {
    const roles = await this.roles
      .createQueryBuilder('role')
      .where('role.code != :platformAdmin', {
        platformAdmin: RoleCode.PlatformAdmin,
      })
      .orderBy('role.name', 'ASC')
      .getMany();
    return roles
      .filter((role) => this.canGrantRole(role, actor))
      .map(({ code, name, description }) => ({ code, name, description }));
  }

  async findAll(query: QueryAssignmentsDto, actor: AuthenticatedUser) {
    const schoolId = this.resolveSchoolScope(query.schoolId, actor);
    const qb = this.assignments
      .createQueryBuilder('assignment')
      .innerJoinAndSelect('assignment.user', 'user')
      .innerJoinAndSelect('assignment.role', 'role')
      .innerJoinAndSelect('assignment.school', 'school')
      .andWhere('role.code != :platformAdmin', {
        platformAdmin: RoleCode.PlatformAdmin,
      })
      .orderBy('assignment.createdAt', 'DESC')
      .skip((query.page - 1) * query.limit)
      .take(query.limit);

    if (schoolId) qb.andWhere('assignment.schoolId = :schoolId', { schoolId });
    if (query.roleCode)
      qb.andWhere('role.code = :roleCode', { roleCode: query.roleCode });
    if (query.search) {
      qb.andWhere(
        '(user.email ILIKE :search OR user.firstName ILIKE :search OR user.lastName ILIKE :search OR role.name ILIKE :search OR school.name ILIKE :search)',
        { search: `%${query.search}%` },
      );
    }

    const [rows, total] = await qb.getManyAndCount();
    const countQb = this.assignments
      .createQueryBuilder('assignment')
      .innerJoin('assignment.role', 'role')
      .select('role.code', 'roleCode')
      .addSelect('COUNT(assignment.id)', 'count')
      .andWhere('role.code != :platformAdmin', {
        platformAdmin: RoleCode.PlatformAdmin,
      })
      .groupBy('role.code');
    if (schoolId)
      countQb.andWhere('assignment.schoolId = :schoolId', { schoolId });
    const counts = await countQb.getRawMany<{
      roleCode: string;
      count: string;
    }>();
    const stats = {
      total: 0,
      schoolAdmins: 0,
      staff: 0,
      students: 0,
      guests: 0,
    };
    for (const { roleCode, count: rawCount } of counts) {
      const count = Number(rawCount);
      stats.total += count;
      if (roleCode === RoleCode.SchoolAdmin) stats.schoolAdmins = count;
      if (roleCode === RoleCode.Staff) stats.staff = count;
      if (roleCode === RoleCode.Student) stats.students = count;
      if (roleCode === RoleCode.Guest) stats.guests = count;
    }

    return {
      data: rows.map((row) => {
        if (!row.school)
          throw new NotFoundException(
            'Établissement de l’affectation introuvable.',
          );
        return {
          id: row.id,
          createdAt: row.createdAt,
          user: {
            id: row.user.id,
            email: row.user.email,
            firstName: row.user.firstName,
            lastName: row.user.lastName,
            status: row.user.status,
          },
          role: {
            code: row.role.code,
            name: row.role.name,
            description: row.role.description,
          },
          school: { id: row.school.id, name: row.school.name },
        };
      }),
      meta: {
        total,
        page: query.page,
        limit: query.limit,
        totalPages: Math.max(1, Math.ceil(total / query.limit)),
      },
      stats,
    };
  }

  async create(dto: CreateAssignmentDto, actor: AuthenticatedUser) {
    const schoolId = this.resolveSchoolScope(dto.schoolId, actor, true);
    if (dto.userId === actor.id) {
      throw new BadRequestException(
        'Vous ne pouvez pas modifier vos propres affectations.',
      );
    }
    if (dto.roleCode === RoleCode.PlatformAdmin) {
      throw new BadRequestException(
        'Ce rôle ne peut pas être attribué depuis ce module.',
      );
    }

    const [user, school, role] = await Promise.all([
      this.users.findOneBy({ id: dto.userId }),
      this.schools.findOneBy({ id: schoolId }),
      this.roles.findOneBy({ code: dto.roleCode }),
    ]);
    if (!user) throw new NotFoundException('Utilisateur introuvable.');
    if (!school || !school.isActive) {
      throw new BadRequestException(
        'L’établissement sélectionné est introuvable ou désactivé.',
      );
    }
    if (user.schoolId !== schoolId) {
      throw new BadRequestException(
        'L’utilisateur doit appartenir à l’établissement sélectionné.',
      );
    }
    if (!role)
      throw new BadRequestException('Le rôle sélectionné est introuvable.');
    if (!this.canGrantRole(role, actor)) {
      throw new ForbiddenException(
        'Vous ne pouvez pas attribuer un rôle avec des droits supérieurs aux vôtres.',
      );
    }

    try {
      const assignment = await this.assignments.save(
        this.assignments.create({ userId: user.id, roleId: role.id, schoolId }),
      );
      return this.findOne(assignment.id, actor);
    } catch (error) {
      const code =
        (error as { code?: string }).code ??
        (error as { driverError?: { code?: string } }).driverError?.code;
      if (error instanceof QueryFailedError && code === '23505') {
        throw new ConflictException(
          'Ce rôle est déjà attribué à cet utilisateur dans cet établissement.',
        );
      }
      throw error;
    }
  }

  private canGrantRole(
    role: Pick<Role, 'code' | 'permissions' | 'documentScopes'>,
    actor: AuthenticatedUser,
  ): boolean {
    if (role.code === RoleCode.PlatformAdmin) return false;
    if (actor.roles.includes(RoleCode.PlatformAdmin)) return true;
    return (
      role.permissions.every((permission) =>
        actor.permissions.includes(permission),
      ) &&
      (role.documentScopes ?? []).every(
        (scope) =>
          scope !== DocumentScope.Platform &&
          actor.documentScopes.includes(scope),
      )
    );
  }

  async remove(id: string, actor: AuthenticatedUser): Promise<void> {
    const assignment = await this.assignments.findOne({
      where: { id },
      relations: { user: true, role: true },
    });
    if (!assignment) throw new NotFoundException('Affectation introuvable.');
    this.assertInScope(assignment, actor);
    if (assignment.userId === actor.id) {
      throw new BadRequestException(
        'Vous ne pouvez pas supprimer vos propres affectations.',
      );
    }
    if (assignment.role.code === RoleCode.SchoolAdmin) {
      const schoolAdminCount = await this.assignments.count({
        where: {
          roleId: assignment.roleId,
          schoolId: assignment.schoolId ?? IsNull(),
        },
      });
      if (schoolAdminCount <= 1) {
        throw new ConflictException(
          'Impossible de retirer le dernier administrateur de cet établissement.',
        );
      }
    }
    await this.assignments.delete({ id });
  }

  private async findOne(id: string, actor: AuthenticatedUser) {
    const assignment = await this.assignments.findOne({
      where: { id },
      relations: { user: true, role: true, school: true },
    });
    if (!assignment) throw new NotFoundException('Affectation introuvable.');
    this.assertInScope(assignment, actor);
    if (!assignment.school)
      throw new NotFoundException(
        'Établissement de l’affectation introuvable.',
      );
    return {
      id: assignment.id,
      createdAt: assignment.createdAt,
      user: {
        id: assignment.user.id,
        email: assignment.user.email,
        firstName: assignment.user.firstName,
        lastName: assignment.user.lastName,
        status: assignment.user.status,
      },
      role: {
        code: assignment.role.code,
        name: assignment.role.name,
        description: assignment.role.description,
      },
      school: { id: assignment.school.id, name: assignment.school.name },
    };
  }

  private resolveSchoolScope(
    requestedSchoolId: string | undefined,
    actor: AuthenticatedUser,
    required: true,
  ): string;
  private resolveSchoolScope(
    requestedSchoolId: string | undefined,
    actor: AuthenticatedUser,
    required?: false,
  ): string | null;
  private resolveSchoolScope(
    requestedSchoolId: string | undefined,
    actor: AuthenticatedUser,
    required = false,
  ): string | null {
    if (actor.roles.includes(RoleCode.PlatformAdmin)) {
      if (requestedSchoolId) return requestedSchoolId;
      if (required)
        throw new BadRequestException(
          'Un établissement doit être sélectionné.',
        );
      return null;
    }
    if (!actor.schoolId)
      throw new ForbiddenException(
        'Aucun établissement associé à votre compte.',
      );
    if (requestedSchoolId && requestedSchoolId !== actor.schoolId) {
      throw new ForbiddenException(
        'Vous ne pouvez gérer que les affectations de votre établissement.',
      );
    }
    return actor.schoolId;
  }

  private assertInScope(
    assignment: Pick<RoleAssignment, 'schoolId'>,
    actor: AuthenticatedUser,
  ): void {
    if (
      !actor.roles.includes(RoleCode.PlatformAdmin) &&
      (!actor.schoolId || assignment.schoolId !== actor.schoolId)
    ) {
      throw new NotFoundException('Affectation introuvable.');
    }
  }
}
