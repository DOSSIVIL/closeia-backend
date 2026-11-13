import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Role } from './entities/role.entity';
import { RoleAssignment } from './entities/role-assignment.entity';
import { RolesManagementService } from './roles-management.service';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator';

describe('RolesManagementService', () => {
  let service: RolesManagementService;
  const platformAdmin: AuthenticatedUser = {
    id: 'platform-admin',
    email: 'admin@example.com',
    schoolId: null,
    roles: ['PLATFORM_ADMIN'],
    permissions: ['roles.read', 'roles.write', 'documents.read'],
    documentScopes: ['PLATFORM', 'SCHOOL', 'ASSIGNED_SPACES', 'OWN_DOCUMENTS'],
    sessionId: 'session',
  };
  const schoolAdmin: AuthenticatedUser = {
    ...platformAdmin,
    roles: ['SCHOOL_ADMIN'],
    permissions: ['roles.read', 'roles.write', 'documents.read'],
    documentScopes: ['SCHOOL'],
  };
  const roles = {
    create: jest.fn((value) => value),
    find: jest.fn(),
    findOneBy: jest.fn(),
    save: jest.fn(),
  };
  const assignments = {
    count: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RolesManagementService,
        { provide: getRepositoryToken(Role), useValue: roles },
        { provide: getRepositoryToken(RoleAssignment), useValue: assignments },
      ],
    }).compile();
    service = module.get(RolesManagementService);
  });

  it('lists roles with assignment counts and the supported catalogues', async () => {
    const queryBuilder = {
      addSelect: jest.fn().mockReturnThis(),
      getRawMany: jest
        .fn()
        .mockResolvedValue([{ roleId: 'role-1', count: '3' }]),
      groupBy: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
    };
    const role = {
      id: 'role-1',
      code: 'CUSTOM',
      name: 'Custom',
      description: null,
      isSystem: false,
      permissions: ['documents.read'],
      documentScopes: ['SCHOOL'],
      updatedAt: new Date(),
    };
    roles.find.mockResolvedValue([role]);
    assignments.createQueryBuilder.mockReturnValue(queryBuilder);

    const result = await service.list();

    expect(result.data[0]).toMatchObject({ id: 'role-1', assignmentCount: 3 });
    expect(result.permissions).toContain('documents.read');
    expect(result.documentScopes).toContain('ASSIGNED_SPACES');
  });

  it('does not allow using a reserved system-role code', async () => {
    await expect(
      service.create(
        {
          code: 'PLATFORM_ADMIN',
          name: 'Replacement',
          permissions: [],
          documentScopes: [],
        },
        platformAdmin,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(roles.save).not.toHaveBeenCalled();
  });

  it('does not allow editing a system role', async () => {
    roles.findOneBy.mockResolvedValue({ id: 'system-role', isSystem: true });

    await expect(
      service.update('system-role', { name: 'Changed' }, platformAdmin),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(roles.save).not.toHaveBeenCalled();
  });

  it('reports an unknown role instead of silently updating it', async () => {
    roles.findOneBy.mockResolvedValue(null);

    await expect(
      service.update('missing-role', { name: 'Changed' }, platformAdmin),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('does not let an administrator create a role above their own permissions', async () => {
    await expect(
      service.create(
        {
          code: 'SUPER_USER',
          name: 'Super user',
          permissions: ['roles.write', 'users.write', 'schools.write'],
          documentScopes: ['SCHOOL'],
        },
        schoolAdmin,
      ),
    ).rejects.toThrow('droits ou périmètres supérieurs');
    expect(roles.save).not.toHaveBeenCalled();
  });
});
