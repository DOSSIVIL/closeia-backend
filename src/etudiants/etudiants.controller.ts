import {
  Body, Controller, Delete, Get, HttpCode, Param, ParseBoolPipe, ParseUUIDPipe, Patch, Post, Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Permissions } from '../common/decorators/permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { Permission } from '../modules/roles/roles.constants';
import { CreateEtudiantDto } from './dto/create-etudiant.dto';
import { QueryEtudiantDto } from './dto/query-etudiant.dto';
import { EtudiantsService } from './etudiants.service';

@ApiTags('etudiants')
@ApiBearerAuth()
@Controller('etablissements/:etablissementId/etudiants')
@Permissions(Permission.UsersRead)
export class EtudiantsController {
  constructor(private readonly service: EtudiantsService) {}

  @Get()
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Param('etablissementId', ParseUUIDPipe) schoolId: string,
    @Query() query: QueryEtudiantDto,
  ) {
    return this.service.findAll(user, schoolId, query);
  }

  @Get(':id')
  findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('etablissementId', ParseUUIDPipe) schoolId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.findOne(user, schoolId, id);
  }

  @Post()
  @Permissions(Permission.UsersWrite)
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Param('etablissementId', ParseUUIDPipe) schoolId: string,
    @Body() dto: CreateEtudiantDto,
  ) {
    return this.service.create(user, schoolId, dto);
  }

  @Patch(':id/statut')
  @Permissions(Permission.UsersWrite)
  setStatut(
    @CurrentUser() user: AuthenticatedUser,
    @Param('etablissementId', ParseUUIDPipe) schoolId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body('actif', ParseBoolPipe) actif: boolean,
  ) {
    return this.service.setStatut(user, schoolId, id, actif);
  }

  /** Retire l'étudiant de l'établissement (le compte n'est pas supprimé). */
  @Delete(':id')
  @Permissions(Permission.UsersWrite)
  @HttpCode(204)
  async remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('etablissementId', ParseUUIDPipe) schoolId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    await this.service.remove(user, schoolId, id);
  }
}
