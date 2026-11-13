import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getDataSourceToken, getRepositoryToken } from '@nestjs/typeorm';
import { User, UserStatus } from './entities/user.entity';
import { RolesService } from '../roles/roles.service';
import { UsersService } from './users.service';
import { School } from '../schools/entities/school.entity';
import { SchoolDomain } from '../schools/entities/school-domain.entity';
import { WelcomeEmailService } from './welcome-email.service';
import { UserImportService } from './user-import.service';

describe('UsersService', () => {
  let service: UsersService;
  const userRepository = {
    delete: jest.fn(),
    findOne: jest.fn(),
    findOneBy: jest.fn(),
    save: jest.fn(),
  };
  const rolesService = { assertAssignableRole: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: getRepositoryToken(User), useValue: userRepository },
        { provide: getRepositoryToken(School), useValue: {} },
        { provide: getRepositoryToken(SchoolDomain), useValue: {} },
        { provide: getDataSourceToken(), useValue: {} },
        { provide: RolesService, useValue: rolesService },
        { provide: WelcomeEmailService, useValue: { sendWelcome: jest.fn() } },
        { provide: UserImportService, useValue: { parseFile: jest.fn() } },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('requires a password before creating a school administrator', async () => {
    rolesService.assertAssignableRole.mockResolvedValue({
      code: 'SCHOOL_ADMIN',
      name: 'Administrateur école',
    } as never);

    await expect(
      service.createAdminUser(
        {
          email: 'admin@school-a.example',
          firstName: 'Admin',
          lastName: 'School',
          schoolId: 'school-a',
          roleCode: 'SCHOOL_ADMIN',
        },
        {
          id: 'creator',
          email: 'creator@school-a.example',
          schoolId: 'school-a',
          roles: ['SCHOOL_ADMIN'],
          permissions: ['users.write'],
          documentScopes: ['SCHOOL'],
          sessionId: 'session',
        },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('does not expose users from another school to school administrators', async () => {
    userRepository.findOne.mockResolvedValue({
      id: 'target-user',
      schoolId: 'school-b',
    });
    const actor = {
      id: 'school-admin',
      email: 'admin@school-a.example',
      schoolId: 'school-a',
      roles: ['SCHOOL_ADMIN'],
      permissions: ['users.read'],
      sessionId: 'session',
    };

    await expect(
      service.findAdminUser('target-user', actor),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('does not allow administrators to suspend their own account', async () => {
    userRepository.findOneBy.mockResolvedValue({
      id: 'school-admin',
      schoolId: 'school-a',
      status: UserStatus.ACTIVE,
      tokenVersion: 0,
    });
    const actor = {
      id: 'school-admin',
      email: 'admin@school-a.example',
      schoolId: 'school-a',
      roles: ['SCHOOL_ADMIN'],
      permissions: ['users.write'],
      sessionId: 'session',
    };

    await expect(
      service.setAdminUserStatus('school-admin', UserStatus.SUSPENDED, actor),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('does not allow administrators to delete their own account', async () => {
    userRepository.findOneBy.mockResolvedValue({
      id: 'school-admin',
      schoolId: 'school-a',
      status: UserStatus.ACTIVE,
    });
    const actor = {
      id: 'school-admin',
      email: 'admin@school-a.example',
      schoolId: 'school-a',
      roles: ['SCHOOL_ADMIN'],
      permissions: ['users.write'],
      sessionId: 'session',
    };

    await expect(
      service.removeAdminUser('school-admin', actor),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(userRepository.delete).not.toHaveBeenCalled();
  });

  it('deletes a user within the administrator school scope', async () => {
    userRepository.findOneBy.mockResolvedValue({
      id: 'target-user',
      schoolId: 'school-a',
    });
    userRepository.delete.mockResolvedValue({ affected: 1 });
    const actor = {
      id: 'school-admin',
      email: 'admin@school-a.example',
      schoolId: 'school-a',
      roles: ['SCHOOL_ADMIN'],
      permissions: ['users.write'],
      sessionId: 'session',
    };

    await expect(
      service.removeAdminUser('target-user', actor),
    ).resolves.toBeUndefined();
    expect(userRepository.delete).toHaveBeenCalledWith({ id: 'target-user' });
  });
});
