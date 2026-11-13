import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { Role } from './entities/role.entity';
import { RoleAssignment } from './entities/role-assignment.entity';
import { assignRole, ensureDefaultRoles } from './roles.bootstrap';
import { ADMIN_ROLE_CODES, DocumentScope, RoleCode } from './roles.constants';

export interface UserAccess {
  roles: string[];
  permissions: string[];
  documentScopes: DocumentScope[];
  isAdmin: boolean;
}

@Injectable()
export class RolesService implements OnModuleInit {
  private readonly logger = new Logger(RolesService.name);

  constructor(
    @InjectRepository(Role) private readonly roles: Repository<Role>,
    @InjectRepository(RoleAssignment)
    private readonly assignments: Repository<RoleAssignment>,
  ) {}

  /** Garantit que les rôles par défaut existent, même si le seed n'a pas été lancé. */
  async onModuleInit(): Promise<void> {
    try {
      await ensureDefaultRoles(this.roles.manager);
    } catch (err) {
      this.logger.error(
        'Vérification des rôles impossible. Les migrations ont-elles été exécutées (npm run migration:run) ?',
        err instanceof Error ? err.stack : String(err),
      );
    }
  }

  assign(
    userId: string,
    roleCode: string,
    schoolId: string | null = null,
    em?: EntityManager,
  ) {
    return assignRole(
      em ?? this.assignments.manager,
      userId,
      roleCode,
      schoolId,
    );
  }

  async listAssignableRoles(actor: AuthenticatedUser) {
    const roles = await this.roles.find({ order: { name: 'ASC' } });
    return roles
      .filter((role) => this.canAssignRole(role, actor))
      .map(({ code, name, description }) => ({ code, name, description }));
  }

  async assertAssignableRole(
    roleCode: string,
    actor: AuthenticatedUser,
  ): Promise<Role> {
    const role = await this.roles.findOneBy({ code: roleCode });
    if (!role)
      throw new NotFoundException('Le rôle sélectionné est introuvable.');
    if (!this.canAssignRole(role, actor)) {
      throw new ForbiddenException('Vous ne pouvez pas attribuer ce rôle.');
    }
    return role;
  }

  private canAssignRole(
    role: Pick<Role, 'code' | 'permissions' | 'documentScopes'>,
    actor: AuthenticatedUser,
  ): boolean {
    if (role.code === RoleCode.PlatformAdmin) {
      return actor.roles.includes(RoleCode.PlatformAdmin);
    }
    if (actor.roles.includes(RoleCode.PlatformAdmin)) return true;
    return (
      role.permissions.every((permission) =>
        actor.permissions.includes(permission),
      ) &&
      (role.documentScopes ?? []).every(
        (scope) =>
          scope !== DocumentScope.Platform &&
          (actor.documentScopes ?? []).includes(scope),
      )
    );
  }

  async getUserAccess(userId: string): Promise<UserAccess> {
    const rows = await this.assignments.find({
      where: { userId },
      relations: { role: true },
    });
    const roles = [...new Set(rows.map((r) => r.role.code))];
    const permissions = [...new Set(rows.flatMap((r) => r.role.permissions))];
    const documentScopes = [
      ...new Set(rows.flatMap((r) => r.role.documentScopes ?? [])),
    ];
    return {
      roles,
      permissions,
      documentScopes,
      isAdmin: roles.some((c) => ADMIN_ROLE_CODES.includes(c)),
    };
  }
}
