import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import type { Repository } from 'typeorm';
import type { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { School } from '../modules/schools/entities/school.entity';
import { SchoolDomain } from '../modules/schools/entities/school-domain.entity';
import { User, UserStatus } from '../modules/users/entities/user.entity';
import type { RolesService } from '../modules/roles/roles.service';
import { EtudiantsService } from './etudiants.service';

const SCHOOL_A = '11111111-1111-4111-8111-111111111111';
const SCHOOL_B = '22222222-2222-4222-8222-222222222222';
const STUDENT_ID = '33333333-3333-4333-8333-333333333333';

const adminOf = (schoolId: string): AuthenticatedUser => ({
  id: 'admin', email: 'a.b@a.org', schoolId, roles: ['SCHOOL_ADMIN'],
  permissions: ['users.read', 'users.write'], sessionId: 's',
});

const student = (overrides: Partial<User> = {}): User =>
  ({
    id: STUDENT_ID, email: 'paul.kamga@ecole-a.org', firstName: 'Paul', lastName: 'Kamga',
    status: UserStatus.ACTIVE, schoolId: SCHOOL_A, avatarUrl: null, lastLoginAt: null,
    createdAt: new Date(), ...overrides,
  }) as User;

function setup() {
  const qb = {
    innerJoin: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    addOrderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getManyAndCount: jest.fn().mockResolvedValue([[student()], 1]),
    getOne: jest.fn().mockResolvedValue(student()),
    getCount: jest.fn().mockResolvedValue(0),
    getMany: jest.fn().mockResolvedValue([]),
  };
  const domains: Record<string, string> = { 'ecole-a.org': SCHOOL_A, 'ecole-b.org': SCHOOL_B };
  const em = {
    createQueryBuilder: jest.fn(() => qb),
    findOneBy: jest.fn(async (entity: unknown, where: { domain?: string; email?: string }): Promise<unknown> => {
      if (entity === SchoolDomain && where.domain && domains[where.domain]) {
        return { domain: where.domain, schoolId: domains[where.domain] };
      }
      return null;
    }),
    create: jest.fn((_entity: unknown, value: Partial<User>) => value),
    save: jest.fn(async (value: Partial<User>) => ({ id: STUDENT_ID, createdAt: new Date(), ...value })),
    update: jest.fn().mockResolvedValue(undefined),
    remove: jest.fn().mockResolvedValue([]),
  };
  const manager = { ...em, transaction: jest.fn((work: (m: typeof em) => Promise<unknown>) => work(em)) };
  const users = { manager };
  const schools = { existsBy: jest.fn().mockResolvedValue(true) };
  const roles = { assign: jest.fn().mockResolvedValue({}) };
  const service = new EtudiantsService(
    users as unknown as Repository<User>,
    schools as unknown as Repository<School>,
    roles as unknown as RolesService,
  );
  return { service, qb, em, manager, roles };
}

describe('EtudiantsService', () => {
  describe('isolation entre établissements', () => {
    it('refuse (404) à l’admin de l’école A toute opération sur l’école B, sans toucher la base', async () => {
      const { service, manager, roles } = setup();
      const admin = adminOf(SCHOOL_A);

      await expect(service.findAll(admin, SCHOOL_B, { page: 1, limit: 20 })).rejects.toThrow(NotFoundException);
      await expect(service.findOne(admin, SCHOOL_B, STUDENT_ID)).rejects.toThrow(NotFoundException);
      await expect(service.create(admin, SCHOOL_B, { email: 'paul.kamga@ecole-b.org' })).rejects.toThrow(NotFoundException);
      await expect(service.setStatut(admin, SCHOOL_B, STUDENT_ID, false)).rejects.toThrow(NotFoundException);
      await expect(service.remove(admin, SCHOOL_B, STUDENT_ID)).rejects.toThrow(NotFoundException);

      expect(manager.createQueryBuilder).not.toHaveBeenCalled();
      expect(manager.transaction).not.toHaveBeenCalled();
      expect(roles.assign).not.toHaveBeenCalled();
    });

    it('limite la recherche aux étudiants rattachés à l’établissement ET porteurs du rôle pour celui-ci', async () => {
      const { service, qb } = setup();
      await service.findAll(adminOf(SCHOOL_A), SCHOOL_A, { page: 1, limit: 20 });
      expect(qb.innerJoin).toHaveBeenCalledWith('u.assignments', 'a', 'a.schoolId = :schoolId', { schoolId: SCHOOL_A });
      expect(qb.innerJoin).toHaveBeenCalledWith('a.role', 'r', 'r.code = :studentCode', { studentCode: 'STUDENT' });
      expect(qb.where).toHaveBeenCalledWith('u.schoolId = :schoolId', { schoolId: SCHOOL_A });
    });

    it('répond 404 pour un étudiant qui n’appartient pas à l’établissement', async () => {
      const { service, qb, em } = setup();
      qb.getOne.mockResolvedValue(null);
      await expect(service.findOne(adminOf(SCHOOL_A), SCHOOL_A, STUDENT_ID)).rejects.toThrow(NotFoundException);
      await expect(service.setStatut(adminOf(SCHOOL_A), SCHOOL_A, STUDENT_ID, false)).rejects.toThrow(NotFoundException);
      expect(em.update).not.toHaveBeenCalled();
    });

    it('refuse d’inscrire dans l’école A une adresse dont le domaine appartient à l’école B', async () => {
      const { service, em, roles } = setup();
      await expect(
        service.create(adminOf(SCHOOL_A), SCHOOL_A, { email: 'paul.kamga@ecole-b.org' }),
      ).rejects.toThrow(BadRequestException);
      expect(em.save).not.toHaveBeenCalled();
      expect(roles.assign).not.toHaveBeenCalled();
    });
  });

  it('refuse une adresse qui ne suit pas le format prenom.nom@domaine', async () => {
    const { service } = setup();
    await expect(service.create(adminOf(SCHOOL_A), SCHOOL_A, { email: 'paul@ecole-a.org' })).rejects.toThrow(BadRequestException);
  });

  it('crée un nouvel étudiant au statut invité avec le rôle étudiant pour cet établissement', async () => {
    const { service, em, roles } = setup();
    const result = await service.create(adminOf(SCHOOL_A), SCHOOL_A, { email: 'awa.ngono@ecole-a.org' });

    expect(em.save).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'awa.ngono@ecole-a.org', firstName: 'Awa', lastName: 'Ngono',
        status: UserStatus.INVITED, schoolId: SCHOOL_A,
      }),
    );
    expect(roles.assign).toHaveBeenCalledWith(STUDENT_ID, 'STUDENT', SCHOOL_A, em);
    expect(result).toMatchObject({ etablissementId: SCHOOL_A, statut: UserStatus.INVITED, prenom: 'Awa' });
  });

  it('donne le rôle étudiant à un compte existant (ex. invité après une connexion Google)', async () => {
    const { service, em, roles } = setup();
    em.findOneBy.mockImplementation(async (entity: unknown, where: { domain?: string; email?: string }) => {
      if (entity === SchoolDomain) return { domain: where.domain, schoolId: SCHOOL_A };
      return student();
    });
    await service.create(adminOf(SCHOOL_A), SCHOOL_A, { email: 'paul.kamga@ecole-a.org' });
    expect(em.create).not.toHaveBeenCalled();
    expect(roles.assign).toHaveBeenCalledWith(STUDENT_ID, 'STUDENT', SCHOOL_A, em);
  });

  it('refuse d’inscrire deux fois le même étudiant', async () => {
    const { service, em, qb, roles } = setup();
    em.findOneBy.mockImplementation(async (entity: unknown, where: { domain?: string }) =>
      entity === SchoolDomain ? { domain: where.domain, schoolId: SCHOOL_A } : student(),
    );
    qb.getCount.mockResolvedValue(1);
    await expect(
      service.create(adminOf(SCHOOL_A), SCHOOL_A, { email: 'paul.kamga@ecole-a.org' }),
    ).rejects.toThrow(ConflictException);
    expect(roles.assign).not.toHaveBeenCalled();
  });

  it('suspend un étudiant et invalide tous ses jetons déjà émis', async () => {
    const { service, em } = setup();
    const result = await service.setStatut(adminOf(SCHOOL_A), SCHOOL_A, STUDENT_ID, false);

    expect(em.update).toHaveBeenCalledWith(User, { id: STUDENT_ID }, {
      status: UserStatus.SUSPENDED,
      tokenVersion: expect.any(Function),
    });
    expect(result.statut).toBe(UserStatus.SUSPENDED);
  });

  it('réactive un étudiant suspendu', async () => {
    const { service, em, qb } = setup();
    qb.getOne.mockResolvedValue(student({ status: UserStatus.SUSPENDED }));
    const result = await service.setStatut(adminOf(SCHOOL_A), SCHOOL_A, STUDENT_ID, true);
    expect(em.update).toHaveBeenCalledWith(User, { id: STUDENT_ID }, { status: UserStatus.ACTIVE });
    expect(result.statut).toBe(UserStatus.ACTIVE);
  });

  it('ne réactive pas un étudiant invité qui ne s’est jamais connecté', async () => {
    const { service, em, qb } = setup();
    qb.getOne.mockResolvedValue(student({ status: UserStatus.INVITED }));
    const result = await service.setStatut(adminOf(SCHOOL_A), SCHOOL_A, STUDENT_ID, true);
    expect(em.update).not.toHaveBeenCalled();
    expect(result.statut).toBe(UserStatus.INVITED);
  });

  it('retire uniquement le rôle étudiant de cet établissement', async () => {
    const { service, qb, em } = setup();
    const assignment = { id: 'assignment' };
    qb.getMany.mockResolvedValue([assignment]);
    await service.remove(adminOf(SCHOOL_A), SCHOOL_A, STUDENT_ID);
    expect(qb.andWhere).toHaveBeenCalledWith('a.schoolId = :schoolId', { schoolId: SCHOOL_A });
    expect(em.remove).toHaveBeenCalledWith([assignment]);
  });
});
