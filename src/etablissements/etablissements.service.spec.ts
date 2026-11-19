import { Repository, EntityManager } from 'typeorm';
import { School } from '../modules/schools/entities/school.entity';
import { SchoolDomain } from '../modules/schools/entities/school-domain.entity';
import { DocumentSpace } from '../espaces-documentaires/entities/document-space.entity';
import { StorageService } from '../storage/storage.service';
import { CreateEtablissementDto } from './dto/create-etablissement.dto';
import { EtablissementsService } from './etablissements.service';

describe('EtablissementsService', () => {
  it('creates the school and its login domain in the existing schools tables', async () => {
    const now = new Date();
    const schoolRepository = {
      findOneBy: jest.fn().mockResolvedValue(null),
      create: jest.fn((value) => ({
        id: 'school-id',
        domains: [],
        createdAt: now,
        updatedAt: now,
        ...value,
      })),
      save: jest.fn(async (value) => value),
    };
    const domainRepository = {
      findOneBy: jest.fn().mockResolvedValue(null),
      create: jest.fn((value) => value),
      save: jest.fn(async (value) => ({ id: 'domain-id', ...value })),
    };
    const spaceRepository = {
      create: jest.fn((value) => value),
      save: jest.fn(async (value) => ({ id: 'space-id', ...value })),
    };
    const transactionManager = {
      getRepository: jest.fn((entity: unknown) =>
        entity === School ? schoolRepository : entity === DocumentSpace ? spaceRepository : domainRepository,
      ),
    };
    const manager = {
      transaction: jest.fn(
        (work: (txManager: EntityManager) => Promise<unknown>) =>
          work(transactionManager as unknown as EntityManager),
      ),
    };
    const schools = { manager } as unknown as Repository<School>;
    const storage = {
      getFileUrl: jest.fn().mockResolvedValue('https://storage.example/logo.png'),
    } as unknown as StorageService;
    const service = new EtablissementsService(
      schools,
      domainRepository as unknown as Repository<SchoolDomain>,
      storage,
    );
    const dto = {
      sigle: 'SJI',
      nom: 'Institut Saint Jean',
      domaineEmail: 'saintjean.example',
    } as CreateEtablissementDto;

    const result = await service.create(dto);

    expect(schoolRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'SJI', name: 'Institut Saint Jean', isActive: true }),
    );
    expect(domainRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({ domain: 'saintjean.example', schoolId: 'school-id' }),
    );
    expect(spaceRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({ schoolId: 'school-id', name: 'Général', isDefault: true }),
    );
    expect(result).toMatchObject({
      id: 'school-id',
      sigle: 'SJI',
      nom: 'Institut Saint Jean',
      domaineEmail: 'saintjean.example',
      actif: true,
      logoUrl: null,
    });
  });
});
