import {
  ForbiddenException, HttpException, HttpStatus, Injectable, Logger, UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService, JwtSignOptions } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { randomUUID } from 'node:crypto';
import { AppException, ErrorCode } from '../../common/filters/app-exception';
import type { RequestMeta } from '../../common/decorators/request-meta.decorator';
import { SchoolsService } from '../schools/schools.service';
import { UsersService } from '../users/users.service';
import { RolesService, UserAccess } from '../roles/roles.service';
import { User, UserStatus } from '../users/entities/user.entity';
import { GoogleVerifierService, VerifiedGoogleProfile } from './google-verifier.service';
import { SessionsService } from './sessions.service';
import { GoogleLoginDto } from './dto/google-login.dto';
import { GoogleCodeLoginDto } from './dto/google-code-login.dto';
import { PasswordLoginDto } from './dto/password-login.dto';
import { ClientKind, JwtPayload, SessionContext, SessionResponse, SessionUser } from './auth.types';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private dummyHash?: Promise<string>;

  constructor(
    private readonly schools: SchoolsService,
    private readonly users: UsersService,
    private readonly roles: RolesService,
    private readonly google: GoogleVerifierService,
    private readonly sessions: SessionsService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  /** Jeton d'identité Google (application mobile). */
  async loginWithGoogle(dto: GoogleLoginDto, meta: RequestMeta = {}): Promise<SessionResponse> {
    const profile = await this.google.verify(dto.idToken);
    return this.completeGoogleLogin(profile, dto.client ?? 'web', false, meta);
  }

  /** Code d'autorisation Google (portail web, bouton personnalisé). */
  async loginWithGoogleCode(dto: GoogleCodeLoginDto, meta: RequestMeta = {}): Promise<SessionResponse> {
    const profile = await this.google.exchangeCode(dto.code);
    return this.completeGoogleLogin(profile, dto.client ?? 'web', dto.rememberMe ?? false, meta);
  }

  async loginWithPassword(dto: PasswordLoginDto, meta: RequestMeta = {}): Promise<SessionResponse> {
    const invalid = () => new UnauthorizedException('Identifiants invalides.');

    let email: string;
    try {
      email = (await this.schools.resolveFromEmail(dto.email)).parsed.email;
    } catch {
      await this.burnHash(dto.password);
      throw invalid();
    }

    const user = await this.users.findByEmailWithPassword(email);
    if (!user?.passwordHash) {
      await this.burnHash(dto.password);
      throw invalid();
    }

    if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
      const minutes = Math.max(1, Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60_000));
      throw new HttpException(
        `Trop de tentatives. Réessayez dans ${minutes} minute(s).`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const valid = await argon2.verify(user.passwordHash, dto.password).catch(() => false);
    if (!valid) {
      await this.users.registerFailedLogin(user.id);
      this.logger.warn(`Échec de connexion : ${email}`);
      throw invalid();
    }

    this.assertAccountActive(user);
    const access = await this.roles.getUserAccess(user.id);
    if (!access.isAdmin) {
      throw new ForbiddenException('La connexion par mot de passe est réservée aux administrateurs.');
    }

    await this.users.registerSuccessfulLogin(user.id);
    this.logger.log(`Connexion administrateur : ${user.email}`);
    return this.buildSession(user, access, dto.rememberMe ?? false, { client: 'web', ...meta });
  }

  async me(userId: string): Promise<SessionUser> {
    const user = await this.users.findById(userId);
    if (!user) throw new UnauthorizedException('Session invalide ou expirée.');
    return this.toSessionUser(user, await this.roles.getUserAccess(user.id));
  }

  /** Ferme la session courante uniquement (les autres appareils restent connectés). */
  async logout(userId: string, sessionId: string): Promise<void> {
    await this.sessions.revoke(sessionId, userId, 'LOGOUT');
    this.logger.log(`Déconnexion : utilisateur ${userId}, session ${sessionId}`);
  }

  /** Ferme toutes les sessions de l'utilisateur, sur tous ses appareils. */
  async logoutAll(userId: string): Promise<void> {
    await this.sessions.revokeAll(userId, 'LOGOUT_ALL');
    await this.users.bumpTokenVersion(userId); // seconde barrière : tout jeton déjà émis devient invalide
    this.logger.log(`Déconnexion de tous les appareils : utilisateur ${userId}`);
  }

  // ---------- internes ----------

  private async completeGoogleLogin(
    profile: VerifiedGoogleProfile,
    client: ClientKind,
    rememberMe: boolean,
    meta: RequestMeta,
  ): Promise<SessionResponse> {
    // 1) syntaxe prenom.nom@domaine + établissement déduit du domaine (exact)
    const { parsed, school } = await this.schools.resolveFromEmail(profile.email);

    // 2) compte Google Workspace d'un domaine autorisé (les Gmail personnels n'ont pas de « hd »)
    const allowed = await this.schools.allowedDomains();
    if (!profile.hd || !allowed.includes(profile.hd)) {
      this.logger.warn(`Connexion Google refusée (hd=${profile.hd ?? 'aucun'}) : ${parsed.email}`);
      throw new AppException(
        HttpStatus.FORBIDDEN, ErrorCode.GoogleWorkspaceRequired,
        'Utilisez le compte Google de votre établissement.', { email: parsed.email },
      );
    }

    // 3) l'utilisateur existe ? sinon il est créé (rôle Invité, aucun droit documentaire)
    const user = await this.users.findOrCreateFromGoogle({
      sub: profile.sub,
      email: parsed.email,
      firstName: profile.givenName ?? parsed.firstName,
      lastName: profile.familyName ?? parsed.lastName,
      avatarUrl: profile.picture,
      schoolId: school.id,
    });
    this.assertAccountActive(user);

    const access = await this.roles.getUserAccess(user.id);
    if (client === 'web' && !access.isAdmin) {
      throw new AppException(
        HttpStatus.FORBIDDEN, ErrorCode.AdminOnlyPortal,
        'Le portail web est réservé aux administrateurs.', { email: user.email },
      );
    }

    await this.users.registerSuccessfulLogin(user.id);
    this.logger.log(`Connexion Google : ${user.email} [${school.code}] (${client})`);
    return this.buildSession(user, access, rememberMe, { client, ...meta });
  }

  private assertAccountActive(user: User): void {
    if (user.status === UserStatus.SUSPENDED) {
      throw new AppException(
        HttpStatus.FORBIDDEN, ErrorCode.AccountSuspended,
        'Ce compte est suspendu. Contactez un administrateur.', { email: user.email },
      );
    }
  }

  /** Dépense le même temps de calcul qu'une vraie vérification (anti énumération de comptes). */
  private async burnHash(password: string): Promise<void> {
    this.dummyHash ??= argon2.hash('spacehub-dummy-password', { type: argon2.argon2id });
    await argon2.verify(await this.dummyHash, password).catch(() => false);
  }

  /** Crée la session en base, puis émet un jeton qui la référence (claim « jti »). */
  private async buildSession(
    user: User,
    access: UserAccess,
    rememberMe: boolean,
    ctx: SessionContext,
  ): Promise<SessionResponse> {
    const sessionId = randomUUID();
    const payload: Omit<JwtPayload, 'jti'> = { sub: user.id, email: user.email, ver: user.tokenVersion };
    const options: JwtSignOptions = { jwtid: sessionId };
    if (rememberMe) {
      options.expiresIn = this.config.get<string>('JWT_REMEMBER_EXPIRES_IN', '7d') as JwtSignOptions['expiresIn'];
    }

    const accessToken = await this.jwt.signAsync(payload, options);
    const { exp } = this.jwt.decode(accessToken) as { exp: number };

    await this.sessions.create({
      id: sessionId,
      userId: user.id,
      client: ctx.client,
      expiresAt: new Date(exp * 1000),
      userAgent: ctx.userAgent,
      ip: ctx.ip,
    });

    return { accessToken, user: this.toSessionUser(user, access) };
  }

  private toSessionUser(user: User, access: UserAccess): SessionUser {
    return {
      id: user.id,
      email: user.email,
      fullName: `${user.firstName} ${user.lastName}`.trim(),
      avatarUrl: user.avatarUrl ?? undefined,
      roles: access.roles,
      permissions: access.permissions,
      documentScopes: access.documentScopes,
      schoolId: user.schoolId ?? undefined,
    };
  }
}
