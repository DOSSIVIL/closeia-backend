import {
  ForbiddenException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { Role } from './entities/role.entity';
import { RoleAssignment } from './entities/role-assignment.entity';
import {
  ALL_DOCUMENT_SCOPES,
  ALL_PERMISSIONS,
  DEFAULT_ROLES,
  DocumentScope,
  RoleCode,
} from './roles.constants';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';

@Injectable()
export class RolesManagementService {
  constructor(
    @InjectRepository(Role) private readonly roles: Repository<Role>,
    @InjectRepository(RoleAssignment)
    private readonly assignments: Repository<RoleAssignment>,
  ) {}

  async list() {
    const roles = await this.roles.find({
      order: { isSystem: 'DESC', name: 'ASC' },
    });
    const counts = await this.assignments
      .createQueryBuilder('assignment')
      .select('assignment.roleId', 'roleId')
      .addSelect('COUNT(assignment.id)', 'count')
      .groupBy('assignment.roleId')
      .getRawMany<{ roleId: string; count: string }>();
    const countByRole = new Map(
      counts.map(({ roleId, count }) => [roleId, Number(count)]),
    );

    return {
      data: roles.map((role) =>
        this.toResponse(role, countByRole.get(role.id) ?? 0),
      ),
      permissions: ALL_PERMISSIONS,
      documentScopes: ALL_DOCUMENT_SCOPES,
    };
  }

  async create(dto: CreateRoleDto, actor: AuthenticatedUser) {
    if (DEFAULT_ROLES.some((role) => role.code === dto.code)) {
      throw new ConflictException('Ce code est réservé à un rôle système.');
    }
    this.assertCanConfigure(dto.permissions, dto.documentScopes, actor);

    const role = this.roles.create({
      code: dto.code,
      name: dto.name.trim(),
      description: dto.description?.trim() || null,
      permissions: [...dto.permissions],
      documentScopes: [...dto.documentScopes],
      isSystem: false,
    });

    try {
      return this.toResponse(await this.roles.save(role), 0);
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        throw new ConflictException('Un rôle utilise déjà ce code.');
      }
      throw error;
    }
  }

  async update(id: string, dto: UpdateRoleDto, actor: AuthenticatedUser) {
    const role = await this.roles.findOneBy({ id });
    if (!role) throw new NotFoundException('Rôle introuvable.');
    if (role.isSystem) {
      throw new ConflictException(
        'Les rôles système ne peuvent pas être modifiés.',
      );
    }

    this.assertCanConfigure(
      dto.permissions ?? role.permissions,
      dto.documentScopes ?? role.documentScopes ?? [],
      actor,
    );
    if (dto.name !== undefined) role.name = dto.name.trim();
    if (dto.description !== undefined)
      role.description = dto.description?.trim() || null;
    if (dto.permissions !== undefined) role.permissions = [...dto.permissions];
    if (dto.documentScopes !== undefined)
      role.documentScopes = [...dto.documentScopes];

    const saved = await this.roles.save(role);
    const assignmentCount = await this.assignments.count({
      where: { roleId: role.id },
    });
    return this.toResponse(saved, assignmentCount);
  }

  private toResponse(role: Role, assignmentCount: number) {
    return {
      id: role.id,
      code: role.code,
      name: role.name,
      description: role.description,
      isSystem: role.isSystem,
      permissions: role.permissions,
      documentScopes: role.documentScopes ?? [],
      assignmentCount,
      updatedAt: role.updatedAt,
    };
  }

  private isUniqueViolation(error: unknown): boolean {
    if (!(error instanceof QueryFailedError)) return false;
    return (error.driverError as { code?: string }).code === '23505';
  }

  private assertCanConfigure(
    permissions: readonly string[],
    documentScopes: readonly DocumentScope[],
    actor: AuthenticatedUser,
  ): void {
    if (actor.roles.includes(RoleCode.PlatformAdmin)) return;
    if (
      !permissions.every((permission) =>
        actor.permissions.includes(permission),
      ) ||
      !documentScopes.every(
        (scope) =>
          scope !== DocumentScope.Platform &&
          actor.documentScopes.includes(scope),
      )
    ) {
      throw new ForbiddenException(
        'Un rôle ne peut pas recevoir des droits ou périmètres supérieurs aux vôtres.',
      );
    }
  }
}
