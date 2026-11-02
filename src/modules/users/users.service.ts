import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, QueryFailedError, Repository } from 'typeorm';
import { AppException, ErrorCode } from '../../common/filters/app-exception';
import { User, UserStatus } from './entities/user.entity';
import { RolesService } from '../roles/roles.service';
import { DEFAULT_ROLE_CODE } from '../roles/roles.constants';

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
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly roles: RolesService,
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
  private async syncGoogleProfile(user: User, input: GoogleProfileInput): Promise<User> {
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
        { failedLoginCount: 0, lockedUntil: new Date(Date.now() + LOCK_MINUTES * 60_000) },
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