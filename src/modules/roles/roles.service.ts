import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { Role } from './entities/role.entity';
import { RoleAssignment } from './entities/role-assignment.entity';
import { assignRole, ensureDefaultRoles } from './roles.bootstrap';
import { ADMIN_ROLE_CODES } from './roles.constants';

export interface UserAccess {
  roles: string[];
  permissions: string[];
  isAdmin: boolean;
}

@Injectable()
export class RolesService implements OnModuleInit {
  private readonly logger = new Logger(RolesService.name);

  constructor(
    @InjectRepository(Role) private readonly roles: Repository<Role>,
    @InjectRepository(RoleAssignment) private readonly assignments: Repository<RoleAssignment>,
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

  assign(userId: string, roleCode: string, schoolId: string | null = null, em?: EntityManager) {
    return assignRole(em ?? this.assignments.manager, userId, roleCode, schoolId);
  }

  async getUserAccess(userId: string): Promise<UserAccess> {
    const rows = await this.assignments.find({ where: { userId }, relations: { role: true } });
    const roles = [...new Set(rows.map((r) => r.role.code))];
    const permissions = [...new Set(rows.flatMap((r) => r.role.permissions))];
    return { roles, permissions, isAdmin: roles.some((c) => ADMIN_ROLE_CODES.includes(c)) };
  }
}