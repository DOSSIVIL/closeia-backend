import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { School } from './entities/school.entity';
import { SchoolDomain } from './entities/school-domain.entity';
import { SchoolsService } from './schools.service';

@Module({
  imports: [TypeOrmModule.forFeature([School, SchoolDomain])],
  providers: [SchoolsService],
  exports: [SchoolsService],
})
export class SchoolsModule {}