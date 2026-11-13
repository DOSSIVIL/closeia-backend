import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Role } from './entities/role.entity';
import { RoleAssignment } from './entities/role-assignment.entity';
import { RolesService } from './roles.service';
import { AssignmentsController } from './assignments.controller';
import { AssignmentsService } from './assignments.service';
import { User } from '../users/entities/user.entity';
import { School } from '../schools/entities/school.entity';
import { RolesManagementController } from './roles-management.controller';
import { RolesManagementService } from './roles-management.service';

@Module({
  imports: [TypeOrmModule.forFeature([Role, RoleAssignment, User, School])],
  controllers: [AssignmentsController, RolesManagementController],
  providers: [RolesService, AssignmentsService, RolesManagementService],
  exports: [RolesService],
})
export class RolesModule {}
