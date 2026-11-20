import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import * as argon2 from 'argon2';
import { SchoolsService } from '../schools/schools.service';
import { RolesService } from '../roles/roles.service';
import { UsersService } from '../users/users.service';
import { User, UserStatus } from '../users/entities/user.entity';
import { GoogleVerifierService } from './google-verifier.service';
import { SessionsService } from './sessions.service';
import { AuthService } from './auth.service';

describe('AuthService password login', () => {
  let service: AuthService;
  const schools = { resolveFromEmail: jest.fn() };
  const users = {
    findByEmailWithPassword: jest.fn(),
    registerFailedLogin: jest.fn(),
    registerSuccessfulLogin: jest.fn(),
  };
  const roles = { getUserAccess: jest.fn() };
  const sessions = { create: jest.fn() };
  const jwt = { signAsync: jest.fn(), decode: jest.fn() };

  const user = (passwordHash: string): User =>
    ({
      id: 'user-id',
      email: 'admin@school.example',
      firstName: 'Admin',
      lastName: 'School',
      avatarUrl: null,
      passwordHash,
      status: UserStatus.ACTIVE,
      schoolId: 'school-id',
      tokenVersion: 0,
      lockedUntil: null,
    }) as User;

  beforeEach(async () => {
    jest.clearAllMocks();
    schools.resolveFromEmail.mockResolvedValue({
      parsed: { email: 'admin@school.example' },
      school: { id: 'school-id' },
    });
    roles.getUserAccess.mockResolvedValue({
      isAdmin: true,
      roles: ['SCHOOL_ADMIN'],
      permissions: ['users.read'],
      documentScopes: ['SCHOOL'],
    });
    users.registerFailedLogin.mockResolvedValue(undefined);
    users.registerSuccessfulLogin.mockResolvedValue(undefined);
    sessions.create.mockResolvedValue(undefined);
    jwt.signAsync.mockResolvedValue('signed-jwt');
    jwt.decode.mockReturnValue({ exp: Math.floor(Date.now() / 1000) + 3600 });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: SchoolsService, useValue: schools },
        { provide: UsersService, useValue: users },
        { provide: RolesService, useValue: roles },
        { provide: GoogleVerifierService, useValue: {} },
        { provide: SessionsService, useValue: sessions },
        { provide: JwtService, useValue: jwt },
        { provide: ConfigService, useValue: { get: jest.fn() } },
      ],
    }).compile();

    service = module.get(AuthService);
  });

  it('authenticates an active administrator and creates a web session', async () => {
    const passwordHash = await argon2.hash('Strong-Admin-Pass-2026');
    users.findByEmailWithPassword.mockResolvedValue(user(passwordHash));

    const result = await service.loginWithPassword({
      email: 'ADMIN@school.example',
      password: 'Strong-Admin-Pass-2026',
      rememberMe: false,
    });

    expect(result.accessToken).toBe('signed-jwt');
    expect(result.user).toMatchObject({
      email: 'admin@school.example',
      roles: ['SCHOOL_ADMIN'],
    });
    expect(schools.resolveFromEmail).toHaveBeenCalledWith(
      'ADMIN@school.example',
    );
    expect(users.registerSuccessfulLogin).toHaveBeenCalledWith('user-id');
    expect(sessions.create).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user-id', client: 'web' }),
    );
  });

  it('rejects invalid credentials and records the failed attempt', async () => {
    const passwordHash = await argon2.hash('Correct-Password-2026');
    users.findByEmailWithPassword.mockResolvedValue(user(passwordHash));

    await expect(
      service.loginWithPassword({
        email: 'admin@school.example',
        password: 'Incorrect-Password-2026',
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(users.registerFailedLogin).toHaveBeenCalledWith('user-id');
    expect(users.registerSuccessfulLogin).not.toHaveBeenCalled();
  });

  it('does not allow a non-administrator to use the web password login', async () => {
    const passwordHash = await argon2.hash('Strong-User-Pass-2026');
    users.findByEmailWithPassword.mockResolvedValue(user(passwordHash));
    roles.getUserAccess.mockResolvedValue({
      isAdmin: false,
      roles: ['STUDENT'],
      permissions: [],
      documentScopes: [],
    });

    await expect(
      service.loginWithPassword({
        email: 'admin@school.example',
        password: 'Strong-User-Pass-2026',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(users.registerSuccessfulLogin).not.toHaveBeenCalled();
  });
});
