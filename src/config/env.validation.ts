import { plainToInstance } from 'class-transformer';
import {
  IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Max, Min, MinLength, validateSync,
} from 'class-validator';

export class EnvironmentVariables {
  @IsIn(['development', 'test', 'production'])
  NODE_ENV: string = 'development';

  @IsInt() @Min(1) @Max(65535)
  PORT: number = 3000;

  @IsString() @IsNotEmpty() CORS_ORIGINS!: string;

  // ==========================================
  // BASE DE DONNÉES NEON
  // ==========================================
  @IsString() @IsNotEmpty() 
  DATABASE_URL!: string;

  // ==========================================
  // STOCKAGE S3 (NEON OBJECT STORAGE)
  // ==========================================
  @IsString() @IsNotEmpty() AWS_ENDPOINT_URL_S3!: string;
  @IsString() @IsNotEmpty() AWS_ACCESS_KEY_ID!: string;
  @IsString() @IsNotEmpty() AWS_SECRET_ACCESS_KEY!: string;
  @IsString() @IsNotEmpty() AWS_REGION!: string;
  @IsString() @IsNotEmpty() AWS_BUCKET_NAME!: string;

  // ==========================================
  // SÉCURITÉ & AUTH
  // ==========================================
  @IsString() @MinLength(32, { message: 'JWT_SECRET doit contenir au moins 32 caractères' })
  JWT_SECRET!: string;
  
  @IsString() @IsNotEmpty() JWT_EXPIRES_IN: string = '8h';
  @IsString() @IsNotEmpty() JWT_REMEMBER_EXPIRES_IN: string = '7d';

  @IsString() @IsNotEmpty() GOOGLE_CLIENT_IDS!: string;
  @IsOptional() @IsString() GOOGLE_CLIENT_SECRET?: string;

  // ==========================================
  // ADMINISTRATEUR (SEED)
  // ==========================================
  @IsString() @IsNotEmpty() SEED_ADMIN_EMAIL!: string;
  @IsString() @IsNotEmpty() SEED_ADMIN_PASSWORD!: string;
  @IsIn(['true', 'false']) SEED_ADMIN_RESET_PASSWORD: string = 'false';
}

export function validateEnv(config: Record<string, unknown>): EnvironmentVariables {
  const validated = plainToInstance(EnvironmentVariables, config, { enableImplicitConversion: true });
  const errors = validateSync(validated, { skipMissingProperties: false });
  
  if (errors.length > 0) {
    const details = errors
      .map((e) => `- ${e.property} : ${Object.values(e.constraints ?? {}).join(', ')}`)
      .join('\n');
    throw new Error(`Fichier .env invalide :\n${details}`);
  }
  return validated;
}