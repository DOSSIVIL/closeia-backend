import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AppException, ErrorCode } from '../../common/filters/app-exception';
import { School } from './entities/school.entity';
import { SchoolDomain } from './entities/school-domain.entity';
import { EMAIL_ERROR_MESSAGES, ParsedSchoolEmail, normalizeEmail, parseSchoolEmail } from './school-email';

export interface ResolvedSchoolEmail {
  parsed: ParsedSchoolEmail;
  school: School;
}

@Injectable()
export class SchoolsService {
  constructor(
    @InjectRepository(SchoolDomain) private readonly domains: Repository<SchoolDomain>,
  ) {}

 
  async resolveFromEmail(raw: unknown): Promise<ResolvedSchoolEmail> {
    const email = normalizeEmail(raw);
    const result = parseSchoolEmail(email);
    if (!result.ok) {
      throw new AppException(HttpStatus.FORBIDDEN, ErrorCode.EmailFormatInvalid, EMAIL_ERROR_MESSAGES[result.reason], { email });
    }

    const row = await this.domains.findOne({
      where: { domain: result.value.domain },
      relations: { school: true },
    });
    if (!row) {
      throw new AppException(HttpStatus.FORBIDDEN, ErrorCode.EmailDomainUnknown, EMAIL_ERROR_MESSAGES.UNKNOWN_DOMAIN, { email });
    }
    if (!row.school.isActive) {
      throw new AppException(HttpStatus.FORBIDDEN, ErrorCode.SchoolInactive, 'Cet établissement est désactivé.', { email });
    }
    return { parsed: result.value, school: row.school };
  }

  /** Domaines des établissements actifs. */
  async allowedDomains(): Promise<string[]> {
    const rows = await this.domains.find({ relations: { school: true } });
    return rows.filter((r) => r.school.isActive).map((r) => r.domain);
  }
}