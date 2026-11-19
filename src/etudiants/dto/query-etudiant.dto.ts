import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { UserStatus } from '../../modules/users/entities/user.entity';

export class QueryEtudiantDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page = 1;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  limit = 20;

  /** Recherche sur l'e-mail, le prénom ou le nom. */
  @IsString()
  @IsOptional()
  search?: string;

  @IsEnum(UserStatus)
  @IsOptional()
  statut?: UserStatus;
}
