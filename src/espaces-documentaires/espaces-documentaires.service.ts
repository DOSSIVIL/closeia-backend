import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Not, Repository } from 'typeorm';
import type { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { SCHOOL_NOT_FOUND_MESSAGE, assertSchoolInScope } from '../common/school-scope';
import { School } from '../modules/schools/entities/school.entity';
import { Permission } from '../modules/roles/roles.constants';
import { DEFAULT_SPACE_NAME, DocumentSpace } from './entities/document-space.entity';
import { CreateEspaceDto } from './dto/create-espace.dto';
import { QueryEspaceDto } from './dto/query-espace.dto';
import { UpdateEspaceDto } from './dto/update-espace.dto';

export interface EspaceResponse {
  id: string;
  etablissementId: string;
  nom: string;
  description: string | null;
  parDefaut: boolean;
  archive: boolean;
  archiveLe: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const SPACE_NOT_FOUND_MESSAGE = 'Espace documentaire introuvable';

/** Crée l'espace par défaut d'un établissement, dans la transaction de création de celui-ci. */
export function createDefaultSpace(manager: EntityManager, schoolId: string): Promise<DocumentSpace> {
  const repo = manager.getRepository(DocumentSpace);
  return repo.save(repo.create({ schoolId, name: DEFAULT_SPACE_NAME, isDefault: true }));
}

@Injectable()
export class EspacesDocumentairesService {
  constructor(
    @InjectRepository(DocumentSpace) private readonly spaces: Repository<DocumentSpace>,
    @InjectRepository(School) private readonly schools: Repository<School>,
  ) {}

  async findAll(user: AuthenticatedUser, schoolId: string, query: QueryEspaceDto) {
    await this.assertSchool(user, schoolId);
    const { page, limit, search } = query;
    const withArchived = query.inclureArchives === true && user.permissions.includes(Permission.DocumentsWrite);

    const qb = this.spaces
      .createQueryBuilder('space')
      .where('space.schoolId = :schoolId', { schoolId })
      .orderBy('space.isDefault', 'DESC')
      .addOrderBy('space.name', 'ASC');
    if (!withArchived) qb.andWhere('space.archivedAt IS NULL');
    if (search?.trim()) qb.andWhere('space.name ILIKE :search', { search: `%${search.trim()}%` });

    const [rows, total] = await qb.skip((page - 1) * limit).take(limit).getManyAndCount();
    return {
      data: rows.map(toResponse),
      meta: { total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)) },
    };
  }

  async findOne(user: AuthenticatedUser, schoolId: string, id: string): Promise<EspaceResponse> {
    await this.assertSchool(user, schoolId);
    const space = await this.getEntity(schoolId, id);
    if (space.archivedAt && !user.permissions.includes(Permission.DocumentsWrite)) {
      throw new NotFoundException(SPACE_NOT_FOUND_MESSAGE);
    }
    return toResponse(space);
  }

  async create(user: AuthenticatedUser, schoolId: string, dto: CreateEspaceDto): Promise<EspaceResponse> {
    await this.assertSchool(user, schoolId);
    await this.assertNameAvailable(schoolId, dto.nom);
    const saved = await this.spaces.save(
      this.spaces.create({ schoolId, name: dto.nom, description: dto.description ?? null, isDefault: false }),
    );
    return toResponse(saved);
  }

  async update(
    user: AuthenticatedUser,
    schoolId: string,
    id: string,
    dto: UpdateEspaceDto,
  ): Promise<EspaceResponse> {
    await this.assertSchool(user, schoolId);
    const space = await this.getEntity(schoolId, id);
    if (dto.nom !== undefined && dto.nom !== space.name) {
      await this.assertNameAvailable(schoolId, dto.nom, space.id);
      space.name = dto.nom;
    }
    if (dto.description !== undefined) space.description = dto.description;
    return toResponse(await this.spaces.save(space));
  }

  /** Archivage logique. L'espace par défaut ne peut pas être archivé. */
  async archive(user: AuthenticatedUser, schoolId: string, id: string): Promise<EspaceResponse> {
    await this.assertSchool(user, schoolId);
    const space = await this.getEntity(schoolId, id);
    if (space.isDefault) {
      throw new ConflictException('L’espace par défaut d’un établissement ne peut pas être archivé');
    }
    if (!space.archivedAt) {
      space.archivedAt = new Date();
      await this.spaces.save(space);
    }
    return toResponse(space);
  }

  async restore(user: AuthenticatedUser, schoolId: string, id: string): Promise<EspaceResponse> {
    await this.assertSchool(user, schoolId);
    const space = await this.getEntity(schoolId, id);
    if (space.archivedAt) {
      space.archivedAt = null;
      await this.spaces.save(space);
    }
    return toResponse(space);
  }

  private async assertSchool(user: AuthenticatedUser, schoolId: string): Promise<void> {
    assertSchoolInScope(user, schoolId);
    if (!(await this.schools.existsBy({ id: schoolId }))) {
      throw new NotFoundException(SCHOOL_NOT_FOUND_MESSAGE);
    }
  }

  /** Toujours filtré par établissement : un espace d'une autre école répond 404. */
  private async getEntity(schoolId: string, id: string): Promise<DocumentSpace> {
    const space = await this.spaces.findOneBy({ id, schoolId });
    if (!space) throw new NotFoundException(SPACE_NOT_FOUND_MESSAGE);
    return space;
  }

  private async assertNameAvailable(schoolId: string, name: string, excludeId?: string): Promise<void> {
    const taken = await this.spaces.existsBy({
      schoolId,
      name,
      ...(excludeId ? { id: Not(excludeId) } : {}),
    });
    if (taken) throw new ConflictException(`Un espace « ${name} » existe déjà dans cet établissement`);
  }
}

function toResponse(space: DocumentSpace): EspaceResponse {
  return {
    id: space.id,
    etablissementId: space.schoolId,
    nom: space.name,
    description: space.description,
    parDefaut: space.isDefault,
    archive: space.archivedAt !== null,
    archiveLe: space.archivedAt,
    createdAt: space.createdAt,
    updatedAt: space.updatedAt,
  };
}
