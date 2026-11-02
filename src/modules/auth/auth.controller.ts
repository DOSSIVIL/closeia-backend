import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { GoogleLoginDto } from './dto/google-login.dto';
import { GoogleCodeLoginDto } from './dto/google-code-login.dto';
import { PasswordLoginDto } from './dto/password-login.dto';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { ReqMeta } from '../../common/decorators/request-meta.decorator';
import type { RequestMeta } from '../../common/decorators/request-meta.decorator';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  /** Portail web : code d'autorisation du bouton Google personnalisé. */
  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('google/code')
  @HttpCode(200)
  googleCode(@Body() dto: GoogleCodeLoginDto, @ReqMeta() meta: RequestMeta) {
    return this.auth.loginWithGoogleCode(dto, meta);
  }

  /** Mobile : jeton d'identité Google. */
  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('google')
  @HttpCode(200)
  google(@Body() dto: GoogleLoginDto, @ReqMeta() meta: RequestMeta) {
    return this.auth.loginWithGoogle(dto, meta);
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('login')
  @HttpCode(200)
  login(@Body() dto: PasswordLoginDto, @ReqMeta() meta: RequestMeta) {
    return this.auth.loginWithPassword(dto, meta);
  }

  @ApiBearerAuth()
  @Get('me')
  me(@CurrentUser() user: AuthenticatedUser) {
    return this.auth.me(user.id);
  }

  /** Déconnexion de l'appareil courant. */
  @ApiBearerAuth()
  @Post('logout')
  @HttpCode(204)
  async logout(@CurrentUser() user: AuthenticatedUser): Promise<void> {
    await this.auth.logout(user.id, user.sessionId);
  }

  /** Déconnexion de tous les appareils. */
  @ApiBearerAuth()
  @Post('logout-all')
  @HttpCode(204)
  async logoutAll(@CurrentUser() user: AuthenticatedUser): Promise<void> {
    await this.auth.logoutAll(user.id);
  }
}