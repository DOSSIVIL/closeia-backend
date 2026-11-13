import { HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { UsersService } from '../../users/users.service';
import { RolesService } from '../../roles/roles.service';
import { UserStatus } from '../../users/entities/user.entity';
import { SessionsService } from '../sessions.service';
import { JWT_AUDIENCE, JWT_ISSUER } from '../auth.constants';
import { AppException, ErrorCode } from '../../../common/filters/app-exception';
import type { AuthenticatedUser } from '../../../common/decorators/current-user.decorator';
import type { JwtPayload } from '../auth.types';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private readonly users: UsersService,
    private readonly roles: RolesService,
    private readonly sessions: SessionsService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('JWT_SECRET'),
      algorithms: ['HS256'],
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
    });
  }

  /**
   * Relu l'état réel à chaque requête : une session fermée, un compte suspendu ou un
   * changement de rôle prennent effet immédiatement.
   */
  async validate(payload: JwtPayload): Promise<AuthenticatedUser> {
    const revoked = () =>
      new AppException(HttpStatus.UNAUTHORIZED, ErrorCode.SessionRevoked, 'Votre session a été fermée. Reconnectez-vous.');

    const user = await this.users.findById(payload.sub);
    if (!user || !payload.jti || user.tokenVersion !== payload.ver) throw revoked();
    if (user.status !== UserStatus.ACTIVE) {
      throw new AppException(HttpStatus.UNAUTHORIZED, ErrorCode.AccountSuspended, 'Ce compte est suspendu. Contactez un administrateur.');
    }
    if (!(await this.sessions.isActive(payload.jti, user.id))) throw revoked();

    const access = await this.roles.getUserAccess(user.id);
    return {
      id: user.id,
      email: user.email,
      schoolId: user.schoolId,
      roles: access.roles,
      permissions: access.permissions,
      documentScopes: access.documentScopes,
      sessionId: payload.jti,
    };
  }
}
