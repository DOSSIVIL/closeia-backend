import { IsEnum } from 'class-validator';
import { UserStatus } from '../entities/user.entity';

export class SetUserStatusDto {
  @IsEnum(UserStatus)
  status!: UserStatus;
}
