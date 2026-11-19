import { PartialType } from '@nestjs/mapped-types';
import { CreateEspaceDto } from './create-espace.dto';

export class UpdateEspaceDto extends PartialType(CreateEspaceDto) {}
