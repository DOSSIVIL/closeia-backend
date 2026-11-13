import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import {
  CurrentUser,
  type AuthenticatedUser,
} from '../../common/decorators/current-user.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { RolesManagementService } from './roles-management.service';

@Controller('roles')
@Permissions('roles.read')
export class RolesManagementController {
  constructor(private readonly roles: RolesManagementService) {}

  @Get()
  list() {
    return this.roles.list();
  }

  @Post()
  @Permissions('roles.write')
  create(@Body() dto: CreateRoleDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.roles.create(dto, actor);
  }

  @Patch(':id')
  @Permissions('roles.write')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateRoleDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.roles.update(id, dto, actor);
  }
}
