import { BadRequestException, Injectable } from '@nestjs/common';
import { parse } from 'csv-parse/sync';
import ExcelJS from 'exceljs';
import { PDFParse } from 'pdf-parse';
import type { CreateUserDto } from './dto/create-user.dto';

export type ImportedUserInput = Pick<
  CreateUserDto,
  'email' | 'firstName' | 'lastName' | 'roleCode'
> & { password?: string; rowNumber: number };

const MAX_FILE_BYTES = 5 * 1024 * 1024;
const MAX_ROWS = 200;
const REQUIRED_COLUMNS = [
  'email',
  'firstName',
  'lastName',
  'roleCode',
] as const;
const COLUMN_ALIASES: Record<
  (typeof REQUIRED_COLUMNS)[number] | 'password',
  string[]
> = {
  email: ['email', 'mail', 'adresseemail', 'courriel'],
  firstName: ['firstname', 'prenom', 'givenname'],
  lastName: ['lastname', 'nom', 'familyname'],
  roleCode: ['rolecode', 'role', 'codeuniforme', 'profil'],
  password: ['password', 'motdepasse', 'motdepasseinitial'],
};

@Injectable()
export class UserImportService {
  async parseFile(file: Express.Multer.File): Promise<ImportedUserInput[]> {
    if (!file?.buffer?.length) {
      throw new BadRequestException('Sélectionnez un fichier à importer.');
    }
    if (file.size > MAX_FILE_BYTES) {
      throw new BadRequestException('Le fichier ne doit pas dépasser 5 Mo.');
    }

    const extension = file.originalname.split('.').pop()?.toLowerCase();
    let rows: unknown[][];
    if (extension === 'csv') {
      rows = this.parseDelimited(file.buffer.toString('utf8'));
    } else if (extension === 'xlsx') {
      rows = await this.parseWorkbook(file.buffer);
    } else if (extension === 'pdf') {
      rows = await this.parsePdf(file.buffer);
    } else {
      throw new BadRequestException(
        'Format non pris en charge. Utilisez un fichier .csv, .xlsx ou .pdf.',
      );
    }

    return this.toUsers(rows);
  }

  private parseDelimited(text: string): unknown[][] {
    const content = text.replace(/^\uFEFF/, '').trim();
    if (!content)
      throw new BadRequestException('Le fichier ne contient aucune donnée.');
    const firstLine = content.split(/\r?\n/, 1)[0] ?? '';
    const delimiter = this.detectDelimiter(firstLine);
    try {
      return parse(content, {
        bom: true,
        delimiter,
        relax_column_count: false,
        skip_empty_lines: true,
        trim: true,
      }) as unknown[][];
    } catch {
      throw new BadRequestException(
        'Le fichier CSV/PDF contient des lignes mal formées.',
      );
    }
  }

  private async parseWorkbook(buffer: Buffer): Promise<unknown[][]> {
    const workbook = new ExcelJS.Workbook();
    try {
      await workbook.xlsx.load(new Uint8Array(buffer).buffer);
    } catch {
      throw new BadRequestException(
        'Impossible de lire ce fichier Excel (.xlsx).',
      );
    }

    const sheet = workbook.worksheets[0];
    if (!sheet)
      throw new BadRequestException(
        'Le fichier Excel ne contient aucune feuille.',
      );
    const rows: unknown[][] = [];
    sheet.eachRow({ includeEmpty: false }, (row) => {
      rows.push(
        (row.values as unknown[]).slice(1).map((value) => this.cellText(value)),
      );
    });
    return rows;
  }

  private async parsePdf(buffer: Buffer): Promise<unknown[][]> {
    const parser = new PDFParse({ data: new Uint8Array(buffer) });
    try {
      const tables = await parser.getTable();
      const tableRows = tables.mergedTables.flat();
      if (tableRows.length > 1) return tableRows;
      const text = await parser.getText();
      if (!text.text.trim()) {
        throw new BadRequestException(
          'Ce PDF ne contient pas de texte extractible. Les PDF scannés nécessitent une reconnaissance OCR.',
        );
      }
      return this.parseDelimited(text.text);
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      throw new BadRequestException(
        'Impossible d’extraire un tableau exploitable de ce PDF. Utilisez un PDF texte avec les colonnes attendues.',
      );
    } finally {
      await parser.destroy();
    }
  }

  private toUsers(rows: unknown[][]): ImportedUserInput[] {
    const header = rows[0];
    if (!header?.length)
      throw new BadRequestException(
        'La première ligne doit contenir les en-têtes de colonnes.',
      );
    const indexes = new Map<string, number>();
    header.forEach((value, index) => {
      const normalized = this.normalizeHeader(this.cellText(value));
      for (const [field, aliases] of Object.entries(COLUMN_ALIASES)) {
        if (aliases.includes(normalized)) indexes.set(field, index);
      }
    });
    const missing = REQUIRED_COLUMNS.filter((column) => !indexes.has(column));
    if (missing.length) {
      throw new BadRequestException(
        `Colonnes obligatoires manquantes : ${missing.join(', ')}. En-têtes attendus : email, firstName, lastName, roleCode; password est requis pour les rôles administrateur.`,
      );
    }

    const records: ImportedUserInput[] = [];
    for (const [index, row] of rows.slice(1).entries()) {
      if (row.every((value) => this.cellText(value).trim() === '')) continue;
      if (records.length >= MAX_ROWS) {
        throw new BadRequestException(
          `Un import est limité à ${MAX_ROWS} utilisateurs.`,
        );
      }
      const read = (field: string) => {
        const column = indexes.get(field);
        return column === undefined ? '' : this.cellText(row[column]).trim();
      };
      records.push({
        email: read('email'),
        firstName: read('firstName'),
        lastName: read('lastName'),
        roleCode: read('roleCode').toUpperCase(),
        password: read('password') || undefined,
        rowNumber: index + 2,
      });
    }
    if (!records.length)
      throw new BadRequestException(
        'Le fichier ne contient aucun utilisateur à importer.',
      );
    return records;
  }

  private cellText(value: unknown): string {
    if (value === null || value === undefined) return '';
    if (typeof value === 'string') return value;
    if (
      typeof value === 'number' ||
      typeof value === 'boolean' ||
      typeof value === 'bigint'
    ) {
      return String(value);
    }
    if (value instanceof Date) return value.toISOString();
    if (typeof value !== 'object') return '';

    if ('text' in value && typeof value.text === 'string') return value.text;
    if ('richText' in value && Array.isArray(value.richText)) {
      return value.richText
        .map((part) =>
          part &&
          typeof part === 'object' &&
          'text' in part &&
          typeof part.text === 'string'
            ? part.text
            : '',
        )
        .join('');
    }
    if ('result' in value) return this.cellText(value.result);
    return '';
  }

  private normalizeHeader(value: string): string {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '');
  }

  private detectDelimiter(line: string): string {
    const delimiters = [';', ',', '\t', '|'];
    return delimiters.reduce((mostLikely, candidate) =>
      line.split(candidate).length > line.split(mostLikely).length
        ? candidate
        : mostLikely,
    );
  }
}
