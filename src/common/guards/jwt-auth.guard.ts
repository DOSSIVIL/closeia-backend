import { ExecutionContext, HttpStatus, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { AppException, ErrorCode } from '../filters/app-exception';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    return isPublic ? true : super.canActivate(context);
  }

  handleRequest<TUser>(err: unknown, user: TUser | false, info?: { name?: string }): TUser {
    if (err) throw err; // erreur déjà qualifiée par la stratégie (session fermée, compte suspendu…)
    if (!user) {
      if (info?.name === 'TokenExpiredError') {
        throw new AppException(HttpStatus.UNAUTHORIZED, ErrorCode.SessionExpired, 'Votre session a expiré. Reconnectez-vous.');
      }
      throw new AppException(HttpStatus.UNAUTHORIZED, ErrorCode.Unauthenticated, 'Connexion requise.');
    }
    return user;
  }
}