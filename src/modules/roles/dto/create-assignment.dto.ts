import { IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateAssignmentDto {
  @IsUUID()
  userId!: string;

  @IsUUID()
  schoolId!: string;

  @IsString()
  @MaxLength(50)
  roleCode!: string;
}
