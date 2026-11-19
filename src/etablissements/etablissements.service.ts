import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { Repository } from 'typeorm';
import { StorageService } from '../storage/storage.service';
import { createDefaultSpace } from '../espaces-documentaires/espaces-documentaires.service';
import { School } from '../modules/schools/entities/school.entity';
import { SchoolDomain } from '../modules/schools/entities/school-domain.entity';
import { CreateEtablissementDto } from './dto/create-etablissement.dto';
import { QueryEtablissementDto } from './dto/query-etablissement.dto';
import { UpdateEtablissementDto } from './dto/update-etablissement.dto';

export type EtablissementResponse = Omit<
  School,
  'domains' | 'logoKey' | 'code' | 'name' | 'isActive'
> & {
  sigle: string;
  nom: string;
  domaineEmail: string;
  actif: boolean;
  logoUrl: string | null;
};

const MIME_EXT: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/svg+xml': 'svg',
};

@Injectable()
export class EtablissementsService {
  constructor(
    @InjectRepository(School)
    private readonly schools: Repository<School>,
    @InjectRepository(SchoolDomain)
    private readonly domains: Repository<SchoolDomain>,
    private readonly storage: StorageService,
  ) {}

  async findAll(query: QueryEtablissementDto) {
    const { page, limit, search, actif } = query;
    const qb = this.schools
      .createQueryBuilder('school')
      .leftJoinAndSelect('school.domains', 'domain')
      .orderBy('school.name', 'ASC')
      .addOrderBy('domain.domain', 'ASC');

    if (search?.trim()) {
      qb.andWhere(
        '(school.name ILIKE :search OR school.code ILIKE :search OR domain.domain ILIKE :search OR school.ville ILIKE :search)',
        { search: `%${search.trim()}%` },
      );
    }
    if (actif !== undefined) qb.andWhere('school.isActive = :actif', { actif });

    const [rows, total] = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return {
      data: await Promise.all(rows.map((school) => this.toResponse(school))),
      meta: { total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)) },
    };
  }

  async findOne(id: string): Promise<EtablissementResponse> {
    return this.toResponse(await this.getEntity(id));
  }

  async create(dto: CreateEtablissementDto): Promise<EtablissementResponse> {
    const school = await this.schools.manager.transaction(async (manager) => {
      const schoolRepo = manager.getRepository(School);
      const domainRepo = manager.getRepository(SchoolDomain);
      await this.assertUnique(dto.sigle, dto.domaineEmail, schoolRepo, domainRepo);

      const created = await schoolRepo.save(
        schoolRepo.create({
          code: dto.sigle,
          name: dto.nom,
          description: dto.description ?? null,
          adresse: dto.adresse ?? null,
          ville: dto.ville ?? null,
          telephone: dto.telephone ?? null,
          emailContact: dto.emailContact ?? null,
          siteWeb: dto.siteWeb ?? null,
          isActive: dto.actif ?? true,
        }),
      );
      created.domains = [
        await domainRepo.save(domainRepo.create({ domain: dto.domaineEmail, schoolId: created.id })),
      ];
      await createDefaultSpace(manager, created.id);
      return created;
    });

    return this.toResponse(school);
  }

  async update(id: string, dto: UpdateEtablissementDto): Promise<EtablissementResponse> {
    const school = await this.schools.manager.transaction(async (manager) => {
      const schoolRepo = manager.getRepository(School);
      const domainRepo = manager.getRepository(SchoolDomain);
      const entity = await schoolRepo.findOne({ where: { id }, relations: { domains: true } });
      if (!entity) throw new NotFoundException('Établissement introuvable');

      await this.assertUnique(dto.sigle, dto.domaineEmail, schoolRepo, domainRepo, id);
      if (dto.sigle !== undefined) entity.code = dto.sigle;
      if (dto.nom !== undefined) entity.name = dto.nom;
      if (dto.description !== undefined) entity.description = dto.description;
      if (dto.adresse !== undefined) entity.adresse = dto.adresse;
      if (dto.ville !== undefined) entity.ville = dto.ville;
      if (dto.telephone !== undefined) entity.telephone = dto.telephone;
      if (dto.emailContact !== undefined) entity.emailContact = dto.emailContact;
      if (dto.siteWeb !== undefined) entity.siteWeb = dto.siteWeb;
      if (dto.actif !== undefined) entity.isActive = dto.actif;

      if (dto.domaineEmail !== undefined) {
        const primaryDomain = entity.domains.sort((a, b) => a.domain.localeCompare(b.domain))[0];
        if (primaryDomain) {
          primaryDomain.domain = dto.domaineEmail;
          await domainRepo.save(primaryDomain);
        } else {
          entity.domains = [
            await domainRepo.save(
              domainRepo.create({ domain: dto.domaineEmail, schoolId: entity.id }),
            ),
          ];
        }
      }

      await schoolRepo.save(entity);
      return entity;
    });

    return this.toResponse(school);
  }

  async setStatut(id: string, actif: boolean): Promise<EtablissementResponse> {
    const entity = await this.getEntity(id);
    entity.isActive = actif;
    return this.toResponse(await this.schools.save(entity));
  }

  async remove(id: string): Promise<void> {
    const entity = await this.getEntity(id);
    if (entity.logoKey) await this.storage.delete(entity.logoKey);
    await this.schools.remove(entity);
  }

  async uploadLogo(id: string, file: Express.Multer.File): Promise<EtablissementResponse> {
    if (!file) throw new BadRequestException('Aucun fichier reçu');
    const ext = MIME_EXT[file.mimetype];
    if (!ext) throw new BadRequestException('Format accepté : PNG, JPG, WEBP ou SVG');

    const entity = await this.getEntity(id);
    const previousKey = entity.logoKey;
    const key = `etablissements/${id}/${randomUUID()}.${ext}`;

    await this.storage.upload(key, file.buffer, file.mimetype);
    entity.logoKey = key;
    const saved = await this.schools.save(entity);

    if (previousKey) await this.storage.delete(previousKey);
    return this.toResponse(saved);
  }

  async removeLogo(id: string): Promise<EtablissementResponse> {
    const entity = await this.getEntity(id);
    if (entity.logoKey) {
      await this.storage.delete(entity.logoKey);
      entity.logoKey = null;
      await this.schools.save(entity);
    }
    return this.toResponse(entity);
  }

  private async getEntity(id: string): Promise<School> {
    const entity = await this.schools.findOne({ where: { id }, relations: { domains: true } });
    if (!entity) throw new NotFoundException('Établissement introuvable');
    entity.domains.sort((a, b) => a.domain.localeCompare(b.domain));
    return entity;
  }

  private async assertUnique(
    sigle: string | undefined,
    domaineEmail: string | undefined,
    schoolRepo: Repository<School>,
    domainRepo: Repository<SchoolDomain>,
    excludeId?: string,
  ): Promise<void> {
    if (sigle) {
      const found = await schoolRepo.findOneBy({ code: sigle });
      if (found && found.id !== excludeId) {
        throw new ConflictException(`Le sigle « ${sigle} » est déjà utilisé`);
      }
    }
    if (domaineEmail) {
      const found = await domainRepo.findOneBy({ domain: domaineEmail });
      if (found && found.schoolId !== excludeId) {
        throw new ConflictException(
          `Le domaine « ${domaineEmail} » est déjà associé à un établissement`,
        );
      }
    }
  }

  private async toResponse(school: School): Promise<EtablissementResponse> {
    const { logoKey, domains, code, name, isActive, ...details } = school;
    const orderedDomains = [...(domains ?? [])].sort((a, b) => a.domain.localeCompare(b.domain));
    const logoUrl = logoKey ? await this.storage.getFileUrl(logoKey) : null;
    return {
      ...details,
      id: school.id,
      sigle: code,
      nom: name,
      domaineEmail: orderedDomains[0]?.domain ?? '',
      actif: isActive,
      logoUrl,
    };
  }
}
