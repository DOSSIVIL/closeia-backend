import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { School } from '../modules/schools/entities/school.entity';
import { DocumentSpace } from './entities/document-space.entity';
import { EspacesDocumentairesController } from './espaces-documentaires.controller';
import { EspacesDocumentairesService } from './espaces-documentaires.service';

@Module({
  imports: [TypeOrmModule.forFeature([DocumentSpace, School])],
  controllers: [EspacesDocumentairesController],
  providers: [EspacesDocumentairesService],
  exports: [EspacesDocumentairesService],
})
export class EspacesDocumentairesModule {}
