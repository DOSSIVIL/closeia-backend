import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseBoolPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { Permissions } from '../common/decorators/permissions.decorator';
import { CreateEtablissementDto } from './dto/create-etablissement.dto';
import { QueryEtablissementDto } from './dto/query-etablissement.dto';
import { UpdateEtablissementDto } from './dto/update-etablissement.dto';
import { EtablissementsService } from './etablissements.service';

const LOGO_OPTIONS = {
  storage: memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 }, // 2 Mo
  fileFilter: (_req: unknown, file: Express.Multer.File, cb: (e: Error | null, ok: boolean) => void) => {
    const ok = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'].includes(file.mimetype);
    cb(ok ? null : new BadRequestException('Format accepté : PNG, JPG, WEBP ou SVG'), ok);
  },
};

@Controller('etablissements')
@Permissions('schools.read')
export class EtablissementsController {
  constructor(private readonly service: EtablissementsService) {}

  // Lecture : tout utilisateur authentifié
  @Get()
  findAll(@Query() query: QueryEtablissementDto) {
    return this.service.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.findOne(id);
  }

  // Écriture : administrateur uniquement
  @Post()
  @Permissions('schools.write')
  create(@Body() dto: CreateEtablissementDto) {
    return this.service.create(dto);
  }

  @Patch(':id')
  @Permissions('schools.write')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateEtablissementDto) {
    return this.service.update(id, dto);
  }

  @Patch(':id/statut')
  @Permissions('schools.write')
  setStatut(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('actif', ParseBoolPipe) actif: boolean,
  ) {
    return this.service.setStatut(id, actif);
  }

  @Post(':id/logo')
  @Permissions('schools.write')
  @UseInterceptors(FileInterceptor('logo', LOGO_OPTIONS))
  uploadLogo(@Param('id', ParseUUIDPipe) id: string, @UploadedFile() file: Express.Multer.File) {
    return this.service.uploadLogo(id, file);
  }

  @Delete(':id/logo')
  @Permissions('schools.write')
  removeLogo(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.removeLogo(id);
  }

  @Delete(':id')
  @Permissions('schools.write')
  @HttpCode(204)
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    await this.service.remove(id);
  }
}