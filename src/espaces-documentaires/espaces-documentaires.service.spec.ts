import { ConflictException, NotFoundException } from '@nestjs/common';
import type { Repository } from 'typeorm';
import type { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { School } from '../modules/schools/entities/school.entity';
import { DocumentSpace } from './entities/document-space.entity';
import { EspacesDocumentairesService } from './espaces-documentaires.service';

const SCHOOL_A = '11111111-1111-4111-8111-111111111111';
const SCHOOL_B = '22222222-2222-4222-8222-222222222222';
const SPACE_ID = '33333333-3333-4333-8333-333333333333';

const adminOf = (schoolId: string): AuthenticatedUser => ({
  id: 'admin', email: 'a.b@a.org', schoolId, roles: ['SCHOOL_ADMIN'],
  permissions: ['documents.read', 'documents.write'], sessionId: 's',
});
const studentOf = (schoolId: string): AuthenticatedUser => ({
  id: 'student', email: 'c.d@a.org', schoolId, roles: ['STUDENT'], permissions: ['documents.read'], sessionId: 's',
});

const space = (overrides: Partial<DocumentSpace> = {}): DocumentSpace =>
  ({
    id: SPACE_ID, schoolId: SCHOOL_A, name: 'Cours', description: null, isDefault: false,
    archivedAt: null, createdAt: new Date(), updatedAt: new Date(), ...overrides,
  }) as DocumentSpace;

function setup() {
  const qb = {
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    addOrderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getManyAndCount: jest.fn().mockResolvedValue([[space()], 1]),
  };
  const spaces = {
    createQueryBuilder: jest.fn(() => qb),
    findOneBy: jest.fn(),
    existsBy: jest.fn().mockResolvedValue(false),
    create: jest.fn((value: Partial<DocumentSpace>) => value),
    save: jest.fn(async (value: Partial<DocumentSpace>) => Object.assign(space(), value)),
  };
  const schools = { existsBy: jest.fn().mockResolvedValue(true) };
  const service = new EspacesDocumentairesService(
    spaces as unknown as Repository<DocumentSpace>,
    schools as unknown as Repository<School>,
  );
  return { service, spaces, schools, qb };
}

describe('EspacesDocumentairesService', () => {
  describe('isolation entre établissements', () => {
    it('refuse (404) à l’admin de l’école A toute opération sur l’école B, sans toucher la base', async () => {
      const { service, spaces } = setup();
      const admin = adminOf(SCHOOL_A);

      await expect(service.findAll(admin, SCHOOL_B, { page: 1, limit: 20 })).rejects.toThrow(NotFoundException);
      await expect(service.findOne(admin, SCHOOL_B, SPACE_ID)).rejects.toThrow(NotFoundException);
      await expect(service.create(admin, SCHOOL_B, { nom: 'Intrus' })).rejects.toThrow(NotFoundException);
      await expect(service.update(admin, SCHOOL_B, SPACE_ID, { nom: 'X' })).rejects.toThrow(NotFoundException);
      await expect(service.archive(admin, SCHOOL_B, SPACE_ID)).rejects.toThrow(NotFoundException);
      await expect(service.restore(admin, SCHOOL_B, SPACE_ID)).rejects.toThrow(NotFoundException);

      expect(spaces.createQueryBuilder).not.toHaveBeenCalled();
      expect(spaces.findOneBy).not.toHaveBeenCalled();
      expect(spaces.save).not.toHaveBeenCalled();
    });

    it('filtre la liste par l’établissement demandé', async () => {
      const { service, qb } = setup();
      await service.findAll(adminOf(SCHOOL_A), SCHOOL_A, { page: 1, limit: 20 });
      expect(qb.where).toHaveBeenCalledWith('space.schoolId = :schoolId', { schoolId: SCHOOL_A });
    });

    it('cherche toujours un espace par identifiant ET établissement (404 pour un espace d’une autre école)', async () => {
      const { service, spaces } = setup();
      spaces.findOneBy.mockResolvedValue(null);
      await expect(service.findOne(adminOf(SCHOOL_A), SCHOOL_A, SPACE_ID)).rejects.toThrow(NotFoundException);
      expect(spaces.findOneBy).toHaveBeenCalledWith({ id: SPACE_ID, schoolId: SCHOOL_A });
    });

    it('répond 404 si l’établissement n’existe pas (administrateur plateforme)', async () => {
      const { service, schools } = setup();
      schools.existsBy.mockResolvedValue(false);
      const platformAdmin = { ...adminOf(SCHOOL_A), roles: ['PLATFORM_ADMIN'] };
      await expect(service.findAll(platformAdmin, SCHOOL_B, { page: 1, limit: 20 })).rejects.toThrow(NotFoundException);
    });
  });

  it('crée l’espace dans l’établissement de l’URL, jamais comme espace par défaut', async () => {
    const { service, spaces } = setup();
    const result = await service.create(adminOf(SCHOOL_A), SCHOOL_A, { nom: 'Cours', description: null });
    expect(spaces.save).toHaveBeenCalledWith(expect.objectContaining({ schoolId: SCHOOL_A, name: 'Cours', isDefault: false }));
    expect(result).toMatchObject({ etablissementId: SCHOOL_A, nom: 'Cours', parDefaut: false, archive: false });
  });

  it('refuse un nom déjà utilisé dans le même établissement', async () => {
    const { service, spaces } = setup();
    spaces.existsBy.mockResolvedValue(true);
    await expect(service.create(adminOf(SCHOOL_A), SCHOOL_A, { nom: 'Cours' })).rejects.toThrow(ConflictException);
    expect(spaces.save).not.toHaveBeenCalled();
  });

  it('refuse d’archiver l’espace par défaut', async () => {
    const { service, spaces } = setup();
    spaces.findOneBy.mockResolvedValue(space({ isDefault: true }));
    await expect(service.archive(adminOf(SCHOOL_A), SCHOOL_A, SPACE_ID)).rejects.toThrow(ConflictException);
    expect(spaces.save).not.toHaveBeenCalled();
  });

  it('archive logiquement un espace', async () => {
    const { service, spaces } = setup();
    spaces.findOneBy.mockResolvedValue(space());
    const result = await service.archive(adminOf(SCHOOL_A), SCHOOL_A, SPACE_ID);
    expect(result.archive).toBe(true);
    expect(spaces.save).toHaveBeenCalledWith(expect.objectContaining({ archivedAt: expect.any(Date) }));
  });

  it('cache les espaces archivés à un élève, même s’il demande à les inclure', async () => {
    const { service, spaces, qb } = setup();
    await service.findAll(studentOf(SCHOOL_A), SCHOOL_A, { page: 1, limit: 20, inclureArchives: true });
    expect(qb.andWhere).toHaveBeenCalledWith('space.archivedAt IS NULL');

    spaces.findOneBy.mockResolvedValue(space({ archivedAt: new Date() }));
    await expect(service.findOne(studentOf(SCHOOL_A), SCHOOL_A, SPACE_ID)).rejects.toThrow(NotFoundException);
  });

  it('montre les espaces archivés à un gestionnaire qui le demande', async () => {
    const { service, qb } = setup();
    await service.findAll(adminOf(SCHOOL_A), SCHOOL_A, { page: 1, limit: 20, inclureArchives: true });
    expect(qb.andWhere).not.toHaveBeenCalledWith('space.archivedAt IS NULL');
  });
});
