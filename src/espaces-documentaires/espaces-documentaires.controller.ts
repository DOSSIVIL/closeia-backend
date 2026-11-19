import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Permissions } from '../common/decorators/permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { Permission } from '../modules/roles/roles.constants';
import { CreateEspaceDto } from './dto/create-espace.dto';
import { QueryEspaceDto } from './dto/query-espace.dto';
import { UpdateEspaceDto } from './dto/update-espace.dto';
import { EspacesDocumentairesService } from './espaces-documentaires.service';

@ApiTags('espaces-documentaires')
@ApiBearerAuth()
@Controller('etablissements/:etablissementId/espaces')
@Permissions(Permission.DocumentsRead)
export class EspacesDocumentairesController {
  constructor(private readonly service: EspacesDocumentairesService) {}

  @Get()
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Param('etablissementId', ParseUUIDPipe) schoolId: string,
    @Query() query: QueryEspaceDto,
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
  @Permissions(Permission.DocumentsWrite)
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Param('etablissementId', ParseUUIDPipe) schoolId: string,
    @Body() dto: CreateEspaceDto,
  ) {
    return this.service.create(user, schoolId, dto);
  }

  @Patch(':id')
  @Permissions(Permission.DocumentsWrite)
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('etablissementId', ParseUUIDPipe) schoolId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateEspaceDto,
  ) {
    return this.service.update(user, schoolId, id, dto);
  }

  /** Archivage logique (pas de suppression physique). */
  @Delete(':id')
  @Permissions(Permission.DocumentsWrite)
  archive(
    @CurrentUser() user: AuthenticatedUser,
    @Param('etablissementId', ParseUUIDPipe) schoolId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.archive(user, schoolId, id);
  }

  @Post(':id/restaurer')
  @Permissions(Permission.DocumentsWrite)
  restore(
    @CurrentUser() user: AuthenticatedUser,
    @Param('etablissementId', ParseUUIDPipe) schoolId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.restore(user, schoolId, id);
  }
}
