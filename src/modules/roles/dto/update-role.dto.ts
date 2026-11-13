import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import {
  ALL_PERMISSIONS,
  ASSIGNABLE_DOCUMENT_SCOPES,
  type DocumentScope,
} from '../roles.constants';

export class UpdateRoleDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string | null;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(ALL_PERMISSIONS.length)
  @IsIn([...ALL_PERMISSIONS], { each: true })
  permissions?: string[];

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(ASSIGNABLE_DOCUMENT_SCOPES.length)
  @IsIn([...ASSIGNABLE_DOCUMENT_SCOPES], { each: true })
  documentScopes?: Exclude<DocumentScope, 'PLATFORM'>[];
}
