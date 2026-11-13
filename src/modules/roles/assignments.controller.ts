import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import {
  CurrentUser,
  type AuthenticatedUser,
} from '../../common/decorators/current-user.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { CreateAssignmentDto } from './dto/create-assignment.dto';
import { QueryAssignmentsDto } from './dto/query-assignments.dto';
import { AssignmentsService } from './assignments.service';

@Controller('assignments')
@Permissions('assignments.read')
export class AssignmentsController {
  constructor(private readonly assignments: AssignmentsService) {}

  @Get('roles')
  listRoles(@CurrentUser() actor: AuthenticatedUser) {
    return this.assignments.listRoles(actor);
  }

  @Get()
  findAll(
    @Query() query: QueryAssignmentsDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.assignments.findAll(query, actor);
  }

  @Post()
  @Permissions('assignments.write')
  create(
    @Body() dto: CreateAssignmentDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.assignments.create(dto, actor);
  }

  @Delete(':id')
  @Permissions('assignments.write')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.assignments.remove(id, actor);
  }
}
