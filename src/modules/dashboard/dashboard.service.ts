import { ForbiddenException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import ExcelJS from 'exceljs';
import { Repository } from 'typeorm';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { RoleCode } from '../roles/roles.constants';
import { School } from '../schools/entities/school.entity';
import { User, UserStatus } from '../users/entities/user.entity';

type RawCount = { status: UserStatus; count: string };
type RawSchoolStatus = { active: boolean; count: string };
type RawRegistration = { month: string; count: string };
type RawRecentSchool = {
  id: string;
  name: string;
  city: string | null;
  active: boolean;
  createdAt: Date;
  userCount: string;
};

export interface DashboardSummary {
  generatedAt: string;
  scope: 'platform' | 'school';
  users: {
    total: number;
    active: number;
    invited: number;
    suspended: number;
    monthlyRegistrations: { month: string; count: number }[];
  };
  schools: {
    total: number;
    active: number;
    inactive: number;
    recent: {
      id: string;
      name: string;
      city: string | null;
      active: boolean;
      createdAt: string;
      userCount: number;
    }[];
  };
}

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(School) private readonly schools: Repository<School>,
  ) {}

  async getSummary(actor: AuthenticatedUser, now = new Date()): Promise<DashboardSummary> {
    const isPlatformAdmin = actor.roles.includes(RoleCode.PlatformAdmin);
    const schoolId = isPlatformAdmin ? null : actor.schoolId;
    if (!isPlatformAdmin && !schoolId) {
      throw new ForbiddenException(
        'Un établissement est requis pour consulter ce tableau de bord.',
      );
    }

    const firstMonth = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5, 1),
    );
    const usersByStatusQuery = this.users
      .createQueryBuilder('user')
      .select('user.status', 'status')
      .addSelect('COUNT(user.id)', 'count')
      .groupBy('user.status');
    const registrationsQuery = this.users
      .createQueryBuilder('user')
      .select("TO_CHAR(DATE_TRUNC('month', user.createdAt), 'YYYY-MM')", 'month')
      .addSelect('COUNT(user.id)', 'count')
      .where('user.createdAt >= :firstMonth', { firstMonth });
    const schoolsByStatusQuery = this.schools
      .createQueryBuilder('school')
      .select('school.isActive', 'active')
      .addSelect('COUNT(school.id)', 'count')
      .groupBy('school.isActive');
    const recentSchoolsQuery = this.schools
      .createQueryBuilder('school')
      .leftJoin(User, 'user', 'user.schoolId = school.id')
      .select('school.id', 'id')
      .addSelect('school.name', 'name')
      .addSelect('school.ville', 'city')
      .addSelect('school.isActive', 'active')
      .addSelect('school.createdAt', 'createdAt')
      .addSelect('COUNT(user.id)', 'userCount')
      .groupBy('school.id')
      .addGroupBy('school.name')
      .addGroupBy('school.ville')
      .addGroupBy('school.isActive')
      .addGroupBy('school.createdAt')
      .orderBy('school.createdAt', 'DESC')
      .limit(5);

    if (schoolId) {
      usersByStatusQuery.where('user.schoolId = :schoolId', { schoolId });
      registrationsQuery.andWhere('user.schoolId = :schoolId', { schoolId });
      schoolsByStatusQuery.where('school.id = :schoolId', { schoolId });
      recentSchoolsQuery.where('school.id = :schoolId', { schoolId });
    }

    const [userRows, registrationRows, schoolRows, recentRows] = await Promise.all([
      usersByStatusQuery.getRawMany<RawCount>(),
      registrationsQuery
        .groupBy("TO_CHAR(DATE_TRUNC('month', user.createdAt), 'YYYY-MM')")
        .orderBy('month', 'ASC')
        .getRawMany<RawRegistration>(),
      schoolsByStatusQuery.getRawMany<RawSchoolStatus>(),
      recentSchoolsQuery.getRawMany<RawRecentSchool>(),
    ]);

    const userCounts = { total: 0, active: 0, invited: 0, suspended: 0 };
    for (const row of userRows) {
      const count = Number(row.count);
      userCounts.total += count;
      if (row.status === UserStatus.ACTIVE) userCounts.active = count;
      if (row.status === UserStatus.INVITED) userCounts.invited = count;
      if (row.status === UserStatus.SUSPENDED) userCounts.suspended = count;
    }

    const registrationsByMonth = new Map(
      registrationRows.map((row) => [row.month, Number(row.count)]),
    );
    const monthlyRegistrations = Array.from({ length: 6 }, (_, index) => {
      const monthDate = new Date(
        Date.UTC(firstMonth.getUTCFullYear(), firstMonth.getUTCMonth() + index, 1),
      );
      const month = `${monthDate.getUTCFullYear()}-${String(monthDate.getUTCMonth() + 1).padStart(2, '0')}`;
      return { month, count: registrationsByMonth.get(month) ?? 0 };
    });

    const schoolCounts = { total: 0, active: 0, inactive: 0 };
    for (const row of schoolRows) {
      const count = Number(row.count);
      schoolCounts.total += count;
      if (row.active) schoolCounts.active = count;
      else schoolCounts.inactive = count;
    }

    return {
      generatedAt: now.toISOString(),
      scope: isPlatformAdmin ? 'platform' : 'school',
      users: { ...userCounts, monthlyRegistrations },
      schools: {
        ...schoolCounts,
        recent: recentRows.map((school) => ({
          id: school.id,
          name: school.name,
          city: school.city,
          active: school.active,
          createdAt: new Date(school.createdAt).toISOString(),
          userCount: Number(school.userCount),
        })),
      },
    };
  }

  async exportExcel(actor: AuthenticatedUser): Promise<Buffer> {
    const summary = await this.getSummary(actor);
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'CloseIA';
    workbook.created = new Date(summary.generatedAt);

    const overview = workbook.addWorksheet('Synthèse');
    overview.columns = [
      { header: 'Indicateur', key: 'label', width: 30 },
      { header: 'Valeur', key: 'value', width: 22 },
    ];
    overview.addRows([
      { label: 'Périmètre', value: summary.scope === 'platform' ? 'Plateforme' : 'Établissement' },
      { label: 'Établissements', value: summary.schools.total },
      { label: 'Établissements actifs', value: summary.schools.active },
      { label: 'Établissements inactifs', value: summary.schools.inactive },
      { label: 'Utilisateurs', value: summary.users.total },
      { label: 'Utilisateurs actifs', value: summary.users.active },
      { label: 'Invitations en attente', value: summary.users.invited },
      { label: 'Utilisateurs suspendus', value: summary.users.suspended },
      { label: 'Généré le', value: new Date(summary.generatedAt) },
    ]);

    const registrations = workbook.addWorksheet('Inscriptions');
    registrations.columns = [
      { header: 'Mois', key: 'month', width: 18 },
      { header: 'Nouveaux comptes', key: 'count', width: 22 },
    ];
    registrations.addRows(summary.users.monthlyRegistrations);

    const schools = workbook.addWorksheet('Établissements');
    schools.columns = [
      { header: 'Nom', key: 'name', width: 32 },
      { header: 'Ville', key: 'city', width: 24 },
      { header: 'Utilisateurs', key: 'userCount', width: 16 },
      { header: 'Statut', key: 'status', width: 16 },
      { header: 'Créé le', key: 'createdAt', width: 22 },
    ];
    schools.addRows(
      summary.schools.recent.map((school) => ({
        name: school.name,
        city: school.city ?? '',
        userCount: school.userCount,
        status: school.active ? 'Actif' : 'Inactif',
        createdAt: new Date(school.createdAt),
      })),
    );

    for (const worksheet of [overview, registrations, schools]) {
      worksheet.getRow(1).font = { bold: true, color: { argb: 'FF303B4B' } };
      worksheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF9AC6F7' },
      };
      worksheet.views = [{ state: 'frozen', ySplit: 1 }];
      worksheet.autoFilter = {
        from: 'A1',
        to: `${String.fromCharCode(64 + worksheet.columnCount)}1`,
      };
    }
    overview.getColumn('value').numFmt = '#,##0';
    overview.getCell('B10').numFmt = 'dd mmm yyyy hh:mm';
    schools.getColumn('createdAt').numFmt = 'dd mmm yyyy';

    return Buffer.from(await workbook.xlsx.writeBuffer());
  }
}
