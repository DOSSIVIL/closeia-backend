import { IsIn, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class GoogleLoginDto {
  @IsString() @IsNotEmpty() @MaxLength(4096)
  idToken!: string;

  /** « web » (portail d'administration) par défaut ; le mobile envoie « mobile ». */
  @IsOptional() @IsIn(['web', 'mobile'])
  client?: 'web' | 'mobile';
}