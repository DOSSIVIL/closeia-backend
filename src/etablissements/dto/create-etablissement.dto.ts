import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  MaxLength,
} from 'class-validator';
import { DOMAIN_REGEX } from '../../modules/schools/school-email';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;
const emptyToNull = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() || null : value;

export class CreateEtablissementDto {
  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'Le nom est obligatoire' })
  @MaxLength(200)
  nom: string;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toUpperCase() : value))
  @Matches(/^[A-Z0-9-]{2,20}$/, {
    message: 'Le sigle doit contenir 2 à 20 caractères (lettres, chiffres, tiret)',
  })
  sigle: string;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @Matches(DOMAIN_REGEX, {
    message: 'Domaine invalide (exemple : saintjeaningenieur.org)',
  })
  @MaxLength(190)
  domaineEmail: string;

  @Transform(emptyToNull)
  @IsOptional()
  @IsString()
  description?: string | null;

  @Transform(emptyToNull)
  @IsOptional()
  @IsString()
  @MaxLength(255)
  adresse?: string | null;

  @Transform(emptyToNull)
  @IsOptional()
  @IsString()
  @MaxLength(100)
  ville?: string | null;

  @Transform(emptyToNull)
  @IsOptional()
  @IsString()
  @MaxLength(30)
  telephone?: string | null;

  @Transform(emptyToNull)
  @IsOptional()
  @IsEmail({}, { message: 'E-mail de contact invalide' })
  @MaxLength(255)
  emailContact?: string | null;

  @Transform(emptyToNull)
  @IsOptional()
  @IsUrl(
    { protocols: ['http', 'https'], require_protocol: true },
    { message: 'URL du site web invalide' },
  )
  @MaxLength(255)
  siteWeb?: string | null;

  @IsOptional()
  @IsBoolean()
  actif?: boolean;
}