import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class PasswordLoginDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsString() @MaxLength(254)
  email!: string;

  @IsString() @MinLength(8) @MaxLength(128)
  password!: string;

  @IsOptional() @IsBoolean()
  rememberMe?: boolean;
}