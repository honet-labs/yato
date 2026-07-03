import { Controller, Get, UseGuards, Patch, Delete, Param, Body } from '@nestjs/common';
import { UserService } from './user.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { Permissions } from '../auth/decorators/permissions.decorator';

@Controller('users')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class UserController {
  constructor(private userService: UserService) {}

  @Get()
  async findAll() {
    return this.userService.findAll();
  }

  @Get(':id')
  @Permissions('MANAGE_USERS')
  async findOne(@Param('id') id: string) {
    return this.userService.findById(id);
  }

  @Patch(':id')
  @Permissions('MANAGE_USERS')
  async update(@Param('id') id: string, @Body() data: Record<string, any>) {
    return this.userService.update(id, data);
  }

  @Delete(':id')
  @Permissions('MANAGE_USERS')
  async remove(@Param('id') id: string) {
    return this.userService.remove(id);
  }
}
