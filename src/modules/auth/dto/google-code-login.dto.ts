import { IsBoolean, IsIn, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class GoogleCodeLoginDto {
  @IsString() @IsNotEmpty() @MaxLength(2048)
  code!: string;

  @IsOptional() @IsIn(['web', 'mobile'])
  client?: 'web' | 'mobile';

  @IsOptional() @IsBoolean()
  rememberMe?: boolean;
}