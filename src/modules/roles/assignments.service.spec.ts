import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { School } from '../schools/entities/school.entity';
import { User } from '../users/entities/user.entity';
import { RoleAssignment } from './entities/role-assignment.entity';
import { Role } from './entities/role.entity';
import { AssignmentsService } from './assignments.service';

describe('AssignmentsService', () => {
  let service: AssignmentsService;
  const assignments = {
    count: jest.fn(),
    delete: jest.fn(),
    findOne: jest.fn(),
    save: jest.fn(),
  };
  const roles = { findOneBy: jest.fn() };
  const users = { findOneBy: jest.fn() };
  const schools = { findOneBy: jest.fn() };
  const schoolAdmin: AuthenticatedUser = {
    id: 'school-admin',
    email: 'admin@school.example',
    schoolId: 'school-a',
    roles: ['SCHOOL_ADMIN'],
    permissions: ['assignments.read', 'assignments.write'],
    documentScopes: ['SCHOOL', 'ASSIGNED_SPACES', 'OWN_DOCUMENTS'],
    sessionId: 'session',
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AssignmentsService,
        { provide: getRepositoryToken(RoleAssignment), useValue: assignments },
        { provide: getRepositoryToken(Role), useValue: roles },
        { provide: getRepositoryToken(User), useValue: users },
        { provide: getRepositoryToken(School), useValue: schools },
      ],
    }).compile();
    service = module.get(AssignmentsService);
  });

  it('prevents an administrator from modifying their own role assignments', async () => {
    await expect(
      service.create(
        { userId: schoolAdmin.id, schoolId: 'school-a', roleCode: 'STAFF' },
        schoolAdmin,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(users.findOneBy).not.toHaveBeenCalled();
  });

  it('prevents assigning a custom role with permissions beyond the actor', async () => {
    users.findOneBy.mockResolvedValue({
      id: 'target-user',
      schoolId: 'school-a',
    });
    schools.findOneBy.mockResolvedValue({ id: 'school-a', isActive: true });
    roles.findOneBy.mockResolvedValue({
      id: 'custom-role',
      code: 'SCHOOL_OWNER',
      permissions: ['users.write', 'roles.write'],
      documentScopes: ['SCHOOL'],
    });

    await expect(
      service.create(
        {
          userId: 'target-user',
          schoolId: 'school-a',
          roleCode: 'SCHOOL_OWNER',
        },
        schoolAdmin,
      ),
    ).rejects.toThrow('droits supérieurs');
    expect(assignments.save).not.toHaveBeenCalled();
  });

  it('hides assignments belonging to another school', async () => {
    assignments.findOne.mockResolvedValue({
      id: 'assignment-b',
      schoolId: 'school-b',
      userId: 'user-b',
      user: {},
      role: { code: 'STAFF' },
    });

    await expect(
      service.remove('assignment-b', schoolAdmin),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(assignments.delete).not.toHaveBeenCalled();
  });

  it('does not remove the last school administrator assignment', async () => {
    assignments.findOne.mockResolvedValue({
      id: 'assignment-admin',
      schoolId: 'school-a',
      roleId: 'role-admin',
      userId: 'other-user',
      user: {},
      role: { code: 'SCHOOL_ADMIN' },
    });
    assignments.count.mockResolvedValue(1);

    await expect(
      service.remove('assignment-admin', schoolAdmin),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(assignments.delete).not.toHaveBeenCalled();
  });
});
