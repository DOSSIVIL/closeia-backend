import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';

export class CreateUserDto {
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  firstName!: string;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  lastName!: string;

  @IsOptional()
  @IsUUID()
  schoolId?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  roleCode!: string;

  @ValidateIf((dto: CreateUserDto) => dto.password !== undefined)
  @IsString()
  @MinLength(12, {
    message:
      'Le mot de passe administrateur doit contenir au moins 12 caractères.',
  })
  @MaxLength(128)
  password?: string;
}
