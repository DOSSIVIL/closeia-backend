import { Transform } from 'class-transformer';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { normalizeEmail } from '../../modules/schools/school-email';

const trimOrUndefined = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() || undefined : value;

export class CreateEtudiantDto {
  /** Adresse de l'établissement, au format prenom.nom@domaine. */
  @Transform(({ value }) => normalizeEmail(value))
  @IsString()
  @IsNotEmpty({ message: 'Adresse e-mail requise.' })
  @MaxLength(254)
  email: string;

  /** Par défaut, déduit de l'adresse e-mail. */
  @Transform(trimOrUndefined)
  @IsOptional()
  @IsString()
  @MaxLength(100)
  prenom?: string;

  /** Par défaut, déduit de l'adresse e-mail. */
  @Transform(trimOrUndefined)
  @IsOptional()
  @IsString()
  @MaxLength(100)
  nom?: string;
}
