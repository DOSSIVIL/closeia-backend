import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule, JwtModuleOptions } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import type { StringValue } from 'ms';

import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { GoogleVerifierService } from './google-verifier.service';
import { SessionsService } from './sessions.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { AuthSession } from './entities/auth-session.entity';
import { JWT_AUDIENCE, JWT_ISSUER } from './auth.constants';
import { UsersModule } from '../users/users.module';
import { RolesModule } from '../roles/roles.module';
import { SchoolsModule } from '../schools/schools.module';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    TypeOrmModule.forFeature([AuthSession]),
    UsersModule,
    RolesModule,
    SchoolsModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService): JwtModuleOptions => ({
        secret: config.getOrThrow<string>('JWT_SECRET'),
        signOptions: {
          algorithm: 'HS256',
          issuer: JWT_ISSUER,
          audience: JWT_AUDIENCE,
          expiresIn: config.get<string>('JWT_EXPIRES_IN', '8h') as StringValue,
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, GoogleVerifierService, SessionsService, JwtStrategy], // JwtStrategy était absente
  exports: [AuthService],
})
export class AuthModule {}