import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { School } from '../modules/schools/entities/school.entity';
import { User } from '../modules/users/entities/user.entity';
import { RolesModule } from '../modules/roles/roles.module';
import { EtudiantsController } from './etudiants.controller';
import { EtudiantsService } from './etudiants.service';

@Module({
  imports: [TypeOrmModule.forFeature([User, School]), RolesModule],
  controllers: [EtudiantsController],
  providers: [EtudiantsService],
})
export class EtudiantsModule {}
