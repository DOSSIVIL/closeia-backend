import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import {
  ALL_PERMISSIONS,
  ASSIGNABLE_DOCUMENT_SCOPES,
  type DocumentScope,
} from '../roles.constants';

export class CreateRoleDto {
  @IsString()
  @Matches(/^[A-Z][A-Z0-9_]{1,49}$/)
  code!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string | null;

  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(ALL_PERMISSIONS.length)
  @IsIn([...ALL_PERMISSIONS], { each: true })
  permissions!: string[];

  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(ASSIGNABLE_DOCUMENT_SCOPES.length)
  @IsIn([...ASSIGNABLE_DOCUMENT_SCOPES], { each: true })
  documentScopes!: Exclude<DocumentScope, 'PLATFORM'>[];
}
