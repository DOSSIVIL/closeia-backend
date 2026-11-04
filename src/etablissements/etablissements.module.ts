import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { School } from '../modules/schools/entities/school.entity';
import { SchoolDomain } from '../modules/schools/entities/school-domain.entity';
import { StorageModule } from '../storage/storage.module';
import { EtablissementsController } from './etablissements.controller';
import { EtablissementsService } from './etablissements.service';

@Module({
  imports: [TypeOrmModule.forFeature([School, SchoolDomain]), StorageModule],
  controllers: [EtablissementsController],
  providers: [EtablissementsService],
  exports: [EtablissementsService],
})
export class EtablissementsModule {}