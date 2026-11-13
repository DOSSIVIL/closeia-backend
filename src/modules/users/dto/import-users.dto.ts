import { IsUUID } from 'class-validator';

export class ImportUsersDto {
  @IsUUID()
  schoolId!: string;
}
