import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, QueryFailedError, Repository, SelectQueryBuilder } from 'typeorm';
import type { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { SCHOOL_NOT_FOUND_MESSAGE, assertSchoolInScope } from '../common/school-scope';
import { School } from '../modules/schools/entities/school.entity';
import { SchoolDomain } from '../modules/schools/entities/school-domain.entity';
import { EMAIL_ERROR_MESSAGES, parseSchoolEmail } from '../modules/schools/school-email';
import { User, UserStatus } from '../modules/users/entities/user.entity';
import { RoleAssignment } from '../modules/roles/entities/role-assignment.entity';
import { RoleCode } from '../modules/roles/roles.constants';
import { RolesService } from '../modules/roles/roles.service';
import { CreateEtudiantDto } from './dto/create-etudiant.dto';
import { QueryEtudiantDto } from './dto/query-etudiant.dto';

export interface EtudiantResponse {
  id: string;
  etablissementId: string;
  email: string;
  prenom: string;
  nom: string;
  statut: UserStatus;
  avatarUrl: string | null;
  derniereConnexion: Date | null;
  createdAt: Date;
}

const STUDENT_NOT_FOUND_MESSAGE = 'Étudiant introuvable';

@Injectable()
export class EtudiantsService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(School) private readonly schools: Repository<School>,
    private readonly roles: RolesService,
  ) {}

  async findAll(user: AuthenticatedUser, schoolId: string, query: QueryEtudiantDto) {
    await this.assertSchool(user, schoolId);
    const { page, limit, search, statut } = query;

    const qb = this.studentsOf(this.users.manager, schoolId)
      .orderBy('u.lastName', 'ASC')
      .addOrderBy('u.firstName', 'ASC');
    if (statut) qb.andWhere('u.status = :statut', { statut });
    if (search?.trim()) {
      qb.andWhere('(u.email ILIKE :search OR u.firstName ILIKE :search OR u.lastName ILIKE :search)', {
        search: `%${search.trim()}%`,
      });
    }

    const [rows, total] = await qb.skip((page - 1) * limit).take(limit).getManyAndCount();
    return {
      data: rows.map((row) => toResponse(row, schoolId)),
      meta: { total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)) },
    };
  }

  async findOne(user: AuthenticatedUser, schoolId: string, id: string): Promise<EtudiantResponse> {
    await this.assertSchool(user, schoolId);
    return toResponse(await this.getStudent(this.users.manager, schoolId, id), schoolId);
  }

  /**
   * Inscrit un étudiant dans l'établissement. Le compte est créé au statut « invité » s'il
   * n'existe pas encore ; il devient actif à sa première connexion Google (comportement existant).
   */
  async create(user: AuthenticatedUser, schoolId: string, dto: CreateEtudiantDto): Promise<EtudiantResponse> {
    await this.assertSchool(user, schoolId);

    const parsed = parseSchoolEmail(dto.email);
    if (!parsed.ok) throw new BadRequestException(EMAIL_ERROR_MESSAGES[parsed.reason]);
    const { email, domain, firstName, lastName } = parsed.value;

    try {
      return await this.users.manager.transaction(async (em) => {
        const owner = await em.findOneBy(SchoolDomain, { domain });
        if (owner?.schoolId !== schoolId) {
          throw new BadRequestException('Le domaine de cette adresse n’appartient pas à cet établissement.');
        }

        let student = await em.findOneBy(User, { email });
        if (student) {
          if (await this.isStudentOf(em, student.id, schoolId)) {
            throw new ConflictException('Cet étudiant est déjà inscrit dans cet établissement.');
          }
          if (student.schoolId !== schoolId) {
            student.schoolId = schoolId;
            student = await em.save(student);
          }
        } else {
          student = await em.save(
            em.create(User, {
              email,
              firstName: dto.prenom ?? firstName,
              lastName: dto.nom ?? lastName,
              status: UserStatus.INVITED,
              schoolId,
            }),
          );
        }

        await this.roles.assign(student.id, RoleCode.Student, schoolId, em);
        return toResponse(student, schoolId);
      });
    } catch (error) {
      // Deux inscriptions simultanées de la même adresse : la contrainte d'unicité a tranché.
      if (error instanceof QueryFailedError && driverCode(error) === '23505') {
        throw new ConflictException('Cet étudiant est déjà inscrit dans cet établissement.');
      }
      throw error;
    }
  }

  /**
   * Suspend ou réactive un étudiant. La suspension invalide aussi tous ses jetons déjà émis,
   * pour qu'une réactivation ne ressuscite pas d'anciennes sessions.
   */
  async setStatut(
    user: AuthenticatedUser,
    schoolId: string,
    id: string,
    actif: boolean,
  ): Promise<EtudiantResponse> {
    await this.assertSchool(user, schoolId);
    return this.users.manager.transaction(async (em) => {
      const student = await this.getStudent(em, schoolId, id);
      if (!actif && student.status !== UserStatus.SUSPENDED) {
        await em.update(User, { id }, {
          status: UserStatus.SUSPENDED,
          tokenVersion: () => '"tokenVersion" + 1',
        });
        student.status = UserStatus.SUSPENDED;
      } else if (actif && student.status === UserStatus.SUSPENDED) {
        await em.update(User, { id }, { status: UserStatus.ACTIVE });
        student.status = UserStatus.ACTIVE;
      }
      return toResponse(student, schoolId);
    });
  }

  /** Retire le rôle d'étudiant dans cet établissement. Le compte est conservé. */
  async remove(user: AuthenticatedUser, schoolId: string, id: string): Promise<void> {
    await this.assertSchool(user, schoolId);
    await this.users.manager.transaction(async (em) => {
      await this.getStudent(em, schoolId, id);
      const assignments = await em
        .createQueryBuilder(RoleAssignment, 'a')
        .innerJoin('a.role', 'r')
        .where('a.userId = :id', { id })
        .andWhere('a.schoolId = :schoolId', { schoolId })
        .andWhere('r.code = :code', { code: RoleCode.Student })
        .getMany();
      await em.remove(assignments);
    });
  }

  private async assertSchool(user: AuthenticatedUser, schoolId: string): Promise<void> {
    assertSchoolInScope(user, schoolId);
    if (!(await this.schools.existsBy({ id: schoolId }))) {
      throw new NotFoundException(SCHOOL_NOT_FOUND_MESSAGE);
    }
  }

  /** Étudiants d'un établissement : rattachés à l'école ET porteurs du rôle étudiant pour cette école. */
  private studentsOf(em: EntityManager, schoolId: string): SelectQueryBuilder<User> {
    return em
      .createQueryBuilder(User, 'u')
      .innerJoin('u.assignments', 'a', 'a.schoolId = :schoolId', { schoolId })
      .innerJoin('a.role', 'r', 'r.code = :studentCode', { studentCode: RoleCode.Student })
      .where('u.schoolId = :schoolId', { schoolId });
  }

  private async getStudent(em: EntityManager, schoolId: string, id: string): Promise<User> {
    const student = await this.studentsOf(em, schoolId).andWhere('u.id = :id', { id }).getOne();
    if (!student) throw new NotFoundException(STUDENT_NOT_FOUND_MESSAGE);
    return student;
  }

  private async isStudentOf(em: EntityManager, userId: string, schoolId: string): Promise<boolean> {
    return (await this.studentsOf(em, schoolId).andWhere('u.id = :userId', { userId }).getCount()) > 0;
  }
}

function driverCode(error: QueryFailedError): string | undefined {
  const { driverError } = error as QueryFailedError & { driverError?: { code?: string } };
  return driverError?.code;
}

function toResponse(user: User, schoolId: string): EtudiantResponse {
  return {
    id: user.id,
    etablissementId: schoolId,
    email: user.email,
    prenom: user.firstName,
    nom: user.lastName,
    statut: user.status,
    avatarUrl: user.avatarUrl,
    derniereConnexion: user.lastLoginAt,
    createdAt: user.createdAt,
  };
}
