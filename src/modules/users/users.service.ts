import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, QueryFailedError, Repository } from 'typeorm';
import * as argon2 from 'argon2';
import { AppException, ErrorCode } from '../../common/filters/app-exception';
import { User, UserStatus } from './entities/user.entity';
import { RolesService } from '../roles/roles.service';
import { DEFAULT_ROLE_CODE, RoleCode } from '../roles/roles.constants';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { CreateUserDto } from './dto/create-user.dto';
import type { ImportUsersDto } from './dto/import-users.dto';
import { QueryUsersDto } from './dto/query-users.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { School } from '../schools/entities/school.entity';
import { SchoolDomain } from '../schools/entities/school-domain.entity';
import {
  EMAIL_ERROR_MESSAGES,
  normalizeEmail,
  parseSchoolEmail,
} from '../schools/school-email';
import { WelcomeEmailService } from './welcome-email.service';
import { ImportedUserInput, UserImportService } from './user-import.service';
import { NotificationsService } from '../notifications/notifications.service';

export interface AdminUserView {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  status: UserStatus;
  school: { id: string; name: string } | null;
  roles: { code: string; name: string }[];
  lastLoginAt: Date | null;
  createdAt: Date;
  welcomeEmailSent?: boolean;
}

export interface AdminUsersPage {
  data: AdminUserView[];
  meta: { total: number; page: number; limit: number; totalPages: number };
  stats: { total: number; active: number; invited: number; suspended: number };
}

export const MAX_FAILED_LOGINS = 5;
export const LOCK_MINUTES = 15;

export interface GoogleProfileInput {
  sub: string;
  email: string;
  firstName: string;
  lastName: string;
  avatarUrl?: string;
  schoolId: string;
}

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(School) private readonly schools: Repository<School>,
    @InjectRepository(SchoolDomain)
    private readonly schoolDomains: Repository<SchoolDomain>,
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly roles: RolesService,
    private readonly welcomeEmail: WelcomeEmailService,
    private readonly userImport: UserImportService,
    private readonly notifications: NotificationsService,
  ) {}

  findById(id: string): Promise<User | null> {
    return this.users.findOneBy({ id });
  }

  /** Charge aussi le hash du mot de passe (colonne exclue par défaut). */
  findByEmailWithPassword(email: string): Promise<User | null> {
    return this.users
      .createQueryBuilder('u')
      .addSelect('u.passwordHash')
      .where('u.email = :email', { email })
      .getOne();
  }

  async findAll(
    query: QueryUsersDto,
    actor: AuthenticatedUser,
  ): Promise<AdminUsersPage> {
    const schoolId = this.resolveSchoolScope(query.schoolId, actor);
    const qb = this.users
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.school', 'school')
      .leftJoinAndSelect('user.assignments', 'assignment')
      .leftJoinAndSelect('assignment.role', 'role')
      .orderBy('user.createdAt', 'DESC')
      .skip((query.page - 1) * query.limit)
      .take(query.limit);

    if (schoolId) qb.andWhere('user.schoolId = :schoolId', { schoolId });
    if (query.status)
      qb.andWhere('user.status = :status', { status: query.status });
    if (query.search) {
      qb.andWhere(
        '(user.email ILIKE :search OR user.firstName ILIKE :search OR user.lastName ILIKE :search)',
        { search: `%${query.search}%` },
      );
    }

    const [users, total] = await qb.getManyAndCount();
    const statsQb = this.users
      .createQueryBuilder('user')
      .select('user.status', 'status')
      .addSelect('COUNT(user.id)', 'count')
      .groupBy('user.status');
    if (schoolId) statsQb.where('user.schoolId = :schoolId', { schoolId });
    const statusCounts = await statsQb.getRawMany<{
      status: UserStatus;
      count: string;
    }>();
    const stats = { total: 0, active: 0, invited: 0, suspended: 0 };
    for (const row of statusCounts) {
      const count = Number(row.count);
      stats.total += count;
      if (row.status === UserStatus.ACTIVE) stats.active = count;
      if (row.status === UserStatus.INVITED) stats.invited = count;
      if (row.status === UserStatus.SUSPENDED) stats.suspended = count;
    }

    return {
      data: users.map((user) => this.toAdminUserView(user)),
      meta: {
        total,
        page: query.page,
        limit: query.limit,
        totalPages: Math.max(1, Math.ceil(total / query.limit)),
      },
      stats,
    };
  }

  async findAdminUser(
    id: string,
    actor: AuthenticatedUser,
  ): Promise<AdminUserView> {
    const user = await this.users.findOne({
      where: { id },
      relations: { school: true, assignments: { role: true } },
    });
    if (!user) throw new NotFoundException('Utilisateur introuvable.');
    this.assertInScope(user, actor);
    return this.toAdminUserView(user);
  }

  listAssignableRoles(actor: AuthenticatedUser) {
    return this.roles.listAssignableRoles(actor);
  }

  async createAdminUser(
    dto: CreateUserDto,
    actor: AuthenticatedUser,
  ): Promise<AdminUserView> {
    const role = await this.roles.assertAssignableRole(dto.roleCode, actor);
    const requiresPassword =
      role.code === RoleCode.SchoolAdmin ||
      role.code === RoleCode.PlatformAdmin;
    if (requiresPassword && !dto.password) {
      throw new BadRequestException(
        'Un mot de passe est obligatoire pour créer un administrateur.',
      );
    }
    if (requiresPassword && dto.password && dto.password.length < 12) {
      throw new BadRequestException(
        'Le mot de passe administrateur doit contenir au moins 12 caractères.',
      );
    }
    if (!requiresPassword && dto.password) {
      throw new BadRequestException(
        'Un mot de passe initial ne peut être défini que pour un administrateur.',
      );
    }
    const schoolId = this.resolveSchoolScope(dto.schoolId, actor, true);
    const email = normalizeEmail(dto.email);
    const school = await this.assertSchoolEmail(email, schoolId);

    if (await this.users.findOneBy({ email })) {
      throw new ConflictException(
        'Un compte existe déjà avec cette adresse e-mail.',
      );
    }

    const password = dto.password;
    const passwordHash =
      requiresPassword && password
        ? await argon2.hash(password, { type: argon2.argon2id })
        : null;

    try {
      const created = await this.dataSource.transaction(async (em) => {
        const user = await em.save(
          em.create(User, {
            email,
            firstName: dto.firstName,
            lastName: dto.lastName,
            schoolId,
            passwordHash,
            status: requiresPassword ? UserStatus.ACTIVE : UserStatus.INVITED,
          }),
        );
        const roleScope =
          role.code === RoleCode.PlatformAdmin ? null : schoolId;
        await this.roles.assign(user.id, role.code, roleScope, em);
        await this.notifications.createForUser(
          user.id,
          {
            kind: 'success',
            title: 'Bienvenue sur CloseIA',
            message: `Votre compte ${role.name} pour ${school.name} a été créé. Consultez le courriel de bienvenue pour vos liens d’accès.`,
          },
          em,
        );
        return user;
      });
      let welcomeEmailSent = false;
      try {
        await this.welcomeEmail.sendWelcome({
          email: created.email,
          firstName: created.firstName,
          lastName: created.lastName,
          roleCode: role.code,
          roleName: role.name,
          schoolName: school.name,
          ...(password ? { password } : {}),
        });
        welcomeEmailSent = true;
      } catch (error) {
        this.logger.error(
          `Compte créé pour ${created.email}, mais courriel de bienvenue non envoyé.`,
          error instanceof Error ? error.stack : String(error),
        );
      }
      return {
        ...(await this.findAdminUser(created.id, actor)),
        welcomeEmailSent,
      };
    } catch (error) {
      const code =
        (error as { code?: string }).code ??
        (error as { driverError?: { code?: string } }).driverError?.code;
      if (error instanceof QueryFailedError && code === '23505') {
        throw new ConflictException(
          'Un compte existe déjà avec cette adresse e-mail.',
        );
      }
      throw error;
    }
  }

  async importAdminUsers(
    file: Express.Multer.File,
    dto: ImportUsersDto,
    actor: AuthenticatedUser,
  ) {
    const importedRows = await this.userImport.parseFile(file);
    const results: {
      rowNumber: number;
      email: string;
      status: 'CREATED' | 'CREATED_EMAIL_FAILED' | 'FAILED';
      message: string;
    }[] = [];

    for (const row of importedRows) {
      try {
        const created = await this.createAdminUser(
          this.toCreateUserDto(row, dto.schoolId),
          actor,
        );
        results.push({
          rowNumber: row.rowNumber,
          email: row.email,
          status: created.welcomeEmailSent ? 'CREATED' : 'CREATED_EMAIL_FAILED',
          message: created.welcomeEmailSent
            ? 'Compte créé et courriel envoyé.'
            : 'Compte créé, mais courriel de bienvenue non envoyé.',
        });
      } catch (error) {
        if (!(error instanceof HttpException)) throw error;
        results.push({
          rowNumber: row.rowNumber,
          email: row.email,
          status: 'FAILED',
          message: this.getHttpErrorMessage(error),
        });
      }
    }

    return {
      total: results.length,
      created: results.filter((result) => result.status !== 'FAILED').length,
      failed: results.filter((result) => result.status === 'FAILED').length,
      emailFailed: results.filter(
        (result) => result.status === 'CREATED_EMAIL_FAILED',
      ).length,
      results,
    };
  }

  private toCreateUserDto(
    row: ImportedUserInput,
    schoolId: string,
  ): CreateUserDto {
    return {
      email: row.email,
      firstName: row.firstName,
      lastName: row.lastName,
      roleCode: row.roleCode,
      password: row.password,
      schoolId,
    };
  }

  private getHttpErrorMessage(error: HttpException): string {
    const response = error.getResponse();
    if (typeof response === 'string') return response;
    if (
      typeof response === 'object' &&
      response !== null &&
      'message' in response
    ) {
      const { message } = response;
      if (typeof message === 'string') return message;
      if (Array.isArray(message)) {
        return message
          .filter((item): item is string => typeof item === 'string')
          .join(' ');
      }
    }
    return 'Les données de cette ligne sont invalides.';
  }

  async updateAdminUser(
    id: string,
    dto: UpdateUserDto,
    actor: AuthenticatedUser,
  ): Promise<AdminUserView> {
    const user = await this.users.findOneBy({ id });
    if (!user) throw new NotFoundException('Utilisateur introuvable.');
    this.assertInScope(user, actor);
    if (dto.firstName !== undefined) user.firstName = dto.firstName;
    if (dto.lastName !== undefined) user.lastName = dto.lastName;
    await this.users.save(user);
    return this.findAdminUser(id, actor);
  }

  async setAdminUserStatus(
    id: string,
    status: UserStatus,
    actor: AuthenticatedUser,
  ): Promise<AdminUserView> {
    const user = await this.users.findOneBy({ id });
    if (!user) throw new NotFoundException('Utilisateur introuvable.');
    this.assertInScope(user, actor);
    if (user.id === actor.id) {
      throw new BadRequestException(
        'Vous ne pouvez pas modifier le statut de votre propre compte.',
      );
    }
    if (user.status !== status) {
      user.status = status;
      user.tokenVersion += 1;
      await this.users.save(user);
    }
    return this.findAdminUser(id, actor);
  }

  async removeAdminUser(id: string, actor: AuthenticatedUser): Promise<void> {
    const user = await this.users.findOneBy({ id });
    if (!user) throw new NotFoundException('Utilisateur introuvable.');
    this.assertInScope(user, actor);
    if (user.id === actor.id) {
      throw new BadRequestException(
        'Vous ne pouvez pas supprimer votre propre compte.',
      );
    }

    try {
      await this.users.delete({ id });
    } catch (error) {
      const code =
        (error as { code?: string }).code ??
        (error as { driverError?: { code?: string } }).driverError?.code;
      if (error instanceof QueryFailedError && code === '23503') {
        throw new ConflictException(
          'Cet utilisateur est associé à des données qui empêchent sa suppression. Vous pouvez plutôt suspendre son compte.',
        );
      }
      throw error;
    }
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
    if (this.isPlatformAdmin(actor)) {
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
        'Vous ne pouvez gérer que les utilisateurs de votre établissement.',
      );
    }
    return actor.schoolId;
  }

  private isPlatformAdmin(actor: AuthenticatedUser): boolean {
    return actor.roles.includes(RoleCode.PlatformAdmin);
  }

  private assertInScope(user: User, actor: AuthenticatedUser): void {
    if (
      !this.isPlatformAdmin(actor) &&
      (!actor.schoolId || user.schoolId !== actor.schoolId)
    ) {
      throw new NotFoundException('Utilisateur introuvable.');
    }
  }

  private async assertSchoolEmail(
    email: string,
    schoolId: string,
  ): Promise<School> {
    const parsed = parseSchoolEmail(email);
    if (!parsed.ok) {
      throw new BadRequestException(EMAIL_ERROR_MESSAGES[parsed.reason]);
    }
    const school = await this.schools.findOneBy({ id: schoolId });
    if (!school || !school.isActive) {
      throw new BadRequestException(
        'L’établissement sélectionné est introuvable ou désactivé.',
      );
    }
    const domain = await this.schoolDomains.findOneBy({
      schoolId,
      domain: parsed.value.domain,
    });
    if (!domain) {
      throw new BadRequestException(
        'Le domaine de cette adresse e-mail ne correspond pas à l’établissement.',
      );
    }
    return school;
  }

  private toAdminUserView(user: User): AdminUserView {
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      avatarUrl: user.avatarUrl,
      status: user.status,
      school: user.school
        ? { id: user.school.id, name: user.school.name }
        : null,
      roles: [
        ...new Map(
          (user.assignments ?? [])
            .filter((assignment) => !!assignment.role)
            .map((assignment) => [
              assignment.role.code,
              { code: assignment.role.code, name: assignment.role.name },
            ]),
        ).values(),
      ],
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt,
    };
  }

  /** Retrouve l'utilisateur ; s'il n'existe pas, le crée avec le rôle par défaut (Invité). */
  async findOrCreateFromGoogle(input: GoogleProfileInput): Promise<User> {
    let user = await this.users.findOneBy({ email: input.email });
    if (user) {
      if (user.googleSub && user.googleSub !== input.sub) {
        throw new AppException(
          HttpStatus.FORBIDDEN,
          ErrorCode.GoogleAccountConflict,
          'Ce compte est déjà lié à une autre identité Google.',
          { email: input.email },
        );
      }
    } else {
      // Même identité Google, mais l'adresse a changé côté Google
      user = await this.users.findOneBy({ googleSub: input.sub });
      if (user) user.email = input.email;
    }
    if (user) return this.syncGoogleProfile(user, input);

    try {
      return await this.dataSource.transaction(async (em) => {
        const created = await em.save(
          em.create(User, {
            email: input.email,
            firstName: input.firstName,
            lastName: input.lastName,
            googleSub: input.sub,
            avatarUrl: input.avatarUrl ?? null,
            schoolId: input.schoolId,
            status: UserStatus.ACTIVE,
          }),
        );
        await this.roles.assign(created.id, DEFAULT_ROLE_CODE, null, em);
        return created;
      });
    } catch (error) {
      // Deux premières connexions simultanées : l'autre requête a déjà créé le compte.
      const code =
        (error as { code?: string }).code ??
        (error as { driverError?: { code?: string } }).driverError?.code;
      if (error instanceof QueryFailedError && code === '23505') {
        const again = await this.users.findOneBy({ email: input.email });
        if (again) return this.syncGoogleProfile(again, input);
      }
      throw error;
    }
  }

  /** Met à jour ce que Google fait autorité : identité liée, photo, établissement, activation. */
  private async syncGoogleProfile(
    user: User,
    input: GoogleProfileInput,
  ): Promise<User> {
    let changed = false;
    if (!user.googleSub) {
      user.googleSub = input.sub;
      changed = true;
    }
    if (input.avatarUrl && user.avatarUrl !== input.avatarUrl) {
      user.avatarUrl = input.avatarUrl;
      changed = true;
    }
    if (user.schoolId !== input.schoolId) {
      user.schoolId = input.schoolId; // l'établissement suit toujours le domaine de l'e-mail
      changed = true;
    }
    if (user.status === UserStatus.INVITED) {
      user.status = UserStatus.ACTIVE;
      changed = true;
    }
    return changed ? this.users.save(user) : user;
  }

  /** Incrémente les échecs ; au 5e, bloque le compte 15 minutes. */
  async registerFailedLogin(userId: string): Promise<void> {
    await this.users.increment({ id: userId }, 'failedLoginCount', 1);
    const user = await this.users.findOneBy({ id: userId });
    if (user && user.failedLoginCount >= MAX_FAILED_LOGINS) {
      await this.users.update(
        { id: userId },
        {
          failedLoginCount: 0,
          lockedUntil: new Date(Date.now() + LOCK_MINUTES * 60_000),
        },
      );
    }
  }

  async registerSuccessfulLogin(userId: string): Promise<void> {
    await this.users.update(
      { id: userId },
      { lastLoginAt: new Date(), failedLoginCount: 0, lockedUntil: null },
    );
  }

  /** Invalide tous les jetons déjà émis pour cet utilisateur. */
  async bumpTokenVersion(userId: string): Promise<void> {
    await this.users.increment({ id: userId }, 'tokenVersion', 1);
  }
}
