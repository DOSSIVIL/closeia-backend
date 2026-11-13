import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  CurrentUser,
  type AuthenticatedUser,
} from '../../common/decorators/current-user.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { CreateUserDto } from './dto/create-user.dto';
import { ImportUsersDto } from './dto/import-users.dto';
import { QueryUsersDto } from './dto/query-users.dto';
import { SetUserStatusDto } from './dto/set-user-status.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UsersService } from './users.service';

@Controller('users')
@Permissions('users.read')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get('roles')
  @Permissions('users.write')
  listAssignableRoles(@CurrentUser() actor: AuthenticatedUser) {
    return this.users.listAssignableRoles(actor);
  }

  @Post('import')
  @Permissions('users.write')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 5 * 1024 * 1024, files: 1 },
    }),
  )
  import(
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: ImportUsersDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.users.importAdminUsers(file, dto, actor);
  }

  @Get()
  findAll(
    @Query() query: QueryUsersDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.users.findAll(query, actor);
  }

  @Get(':id')
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.users.findAdminUser(id, actor);
  }

  @Post()
  @Permissions('users.write')
  create(@Body() dto: CreateUserDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.users.createAdminUser(dto, actor);
  }

  @Patch(':id')
  @Permissions('users.write')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.users.updateAdminUser(id, dto, actor);
  }

  @Patch(':id/status')
  @Permissions('users.write')
  setStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetUserStatusDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.users.setAdminUserStatus(id, dto.status, actor);
  }

  @Delete(':id')
  @Permissions('users.write')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.users.removeAdminUser(id, actor);
  }
}
