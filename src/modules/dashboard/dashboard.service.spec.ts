import { ForbiddenException } from '@nestjs/common';
import ExcelJS from 'exceljs';
import type { Repository, SelectQueryBuilder } from 'typeorm';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { School } from '../schools/entities/school.entity';
import { User, UserStatus } from '../users/entities/user.entity';
import { DashboardService } from './dashboard.service';

function queryBuilder(rows: object[]) {
  const builder = {
    select: jest.fn(),
    addSelect: jest.fn(),
    leftJoin: jest.fn(),
    groupBy: jest.fn(),
    addGroupBy: jest.fn(),
    where: jest.fn(),
    andWhere: jest.fn(),
    orderBy: jest.fn(),
    limit: jest.fn(),
    getRawMany: jest.fn().mockResolvedValue(rows),
  };
  for (const method of [
    'select',
    'addSelect',
    'leftJoin',
    'groupBy',
    'addGroupBy',
    'where',
    'andWhere',
    'orderBy',
    'limit',
  ] as const) {
    builder[method].mockReturnValue(builder);
  }
  return builder as unknown as SelectQueryBuilder<User | School>;
}

describe('DashboardService', () => {
  const actor = (overrides: Partial<AuthenticatedUser> = {}): AuthenticatedUser => ({
    id: 'admin-1',
    email: 'admin@example.org',
    schoolId: null,
    roles: ['PLATFORM_ADMIN'],
    permissions: ['dashboard.read'],
    documentScopes: [],
    sessionId: 'session-1',
    ...overrides,
  });

  it('aggregates real account and establishment counts and fills missing months with zero', async () => {
    const userStatusQuery = queryBuilder([
      { status: UserStatus.ACTIVE, count: '8' },
      { status: UserStatus.INVITED, count: '2' },
      { status: UserStatus.SUSPENDED, count: '1' },
    ]);
    const registrationQuery = queryBuilder([{ month: '2026-11', count: '2' }]);
    const schoolStatusQuery = queryBuilder([
      { active: true, count: '2' },
      { active: false, count: '1' },
    ]);
    const recentSchoolsQuery = queryBuilder([
      {
        id: 'school-1',
        name: 'Établissement test',
        city: 'Douala',
        active: true,
        createdAt: new Date('2026-11-01T00:00:00.000Z'),
        userCount: '8',
      },
    ]);
    const users = {
      createQueryBuilder: jest.fn().mockReturnValueOnce(userStatusQuery).mockReturnValueOnce(registrationQuery),
    } as unknown as Repository<User>;
    const schools = {
      createQueryBuilder: jest.fn().mockReturnValueOnce(schoolStatusQuery).mockReturnValueOnce(recentSchoolsQuery),
    } as unknown as Repository<School>;
    const service = new DashboardService(users, schools);

    const summary = await service.getSummary(actor(), new Date('2026-11-20T09:00:00.000Z'));

    expect(summary.users).toMatchObject({
      total: 11,
      active: 8,
      invited: 2,
      suspended: 1,
    });
    expect(summary.users.monthlyRegistrations).toHaveLength(6);
    expect(summary.users.monthlyRegistrations.at(-1)).toEqual({ month: '2026-11', count: 2 });
    expect(summary.users.monthlyRegistrations.slice(0, 5).every((month) => month.count === 0)).toBe(true);
    expect(summary.schools).toMatchObject({ total: 3, active: 2, inactive: 1 });
    expect(summary.schools.recent[0]).toMatchObject({
      name: 'Établissement test',
      userCount: 8,
    });
  });

  it('restricts school administrators to their own establishment', async () => {
    const userStatusQuery = queryBuilder([]);
    const registrationQuery = queryBuilder([]);
    const schoolStatusQuery = queryBuilder([]);
    const recentSchoolsQuery = queryBuilder([]);
    const users = {
      createQueryBuilder: jest.fn().mockReturnValueOnce(userStatusQuery).mockReturnValueOnce(registrationQuery),
    } as unknown as Repository<User>;
    const schools = {
      createQueryBuilder: jest.fn().mockReturnValueOnce(schoolStatusQuery).mockReturnValueOnce(recentSchoolsQuery),
    } as unknown as Repository<School>;
    const service = new DashboardService(users, schools);

    const summary = await service.getSummary(
      actor({ roles: ['SCHOOL_ADMIN'], schoolId: 'school-1' }),
      new Date('2026-11-20T09:00:00.000Z'),
    );

    expect(summary.scope).toBe('school');
    expect(userStatusQuery.where).toHaveBeenCalledWith('user.schoolId = :schoolId', {
      schoolId: 'school-1',
    });
    expect(schoolStatusQuery.where).toHaveBeenCalledWith('school.id = :schoolId', {
      schoolId: 'school-1',
    });
  });

  it('rejects non-platform users without an establishment scope', async () => {
    const users = { createQueryBuilder: jest.fn() } as unknown as Repository<User>;
    const schools = { createQueryBuilder: jest.fn() } as unknown as Repository<School>;
    const service = new DashboardService(users, schools);

    await expect(
      service.getSummary(actor({ roles: ['SCHOOL_ADMIN'], schoolId: null })),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(users.createQueryBuilder).not.toHaveBeenCalled();
  });

  it('exports an Excel workbook with the dashboard sheets', async () => {
    const userStatusQuery = queryBuilder([{ status: UserStatus.ACTIVE, count: '1' }]);
    const registrationQuery = queryBuilder([]);
    const schoolStatusQuery = queryBuilder([{ active: true, count: '1' }]);
    const recentSchoolsQuery = queryBuilder([]);
    const users = {
      createQueryBuilder: jest.fn().mockReturnValueOnce(userStatusQuery).mockReturnValueOnce(registrationQuery),
    } as unknown as Repository<User>;
    const schools = {
      createQueryBuilder: jest.fn().mockReturnValueOnce(schoolStatusQuery).mockReturnValueOnce(recentSchoolsQuery),
    } as unknown as Repository<School>;
    const service = new DashboardService(users, schools);

    const content = await service.exportExcel(actor());
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(content);

    expect(workbook.worksheets.map((worksheet) => worksheet.name)).toEqual([
      'Synthèse',
      'Inscriptions',
      'Établissements',
    ]);
    expect(workbook.getWorksheet('Synthèse')?.getCell('B6').value).toBe(1);
  });
});
