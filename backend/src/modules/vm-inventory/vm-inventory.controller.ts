import { Controller, Get, Post, Delete, Put, Body, Param, UseGuards, Query, Req } from '@nestjs/common';
import { VmInventoryService } from './vm-inventory.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { AuthService } from '../auth/auth.service';

@Controller('vm-inventory')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class VmInventoryController {
  constructor(
    private vmInventoryService: VmInventoryService,
    private authService: AuthService,
  ) {}

  @Post()
  @Permissions('PROVISION_VM')
  async create(@Body() data: any, @Req() req: any) {
    return this.vmInventoryService.create(data, req.user.id);
  }

  @Get()
  async findAll(@Query('scope') scope: string, @Req() req: any) {
    const hasAccessToAll = req.user.roles?.some((r: any) => 
      r.role.name === 'ADMIN' || 
      r.role.permissions?.includes('MANAGE_VM_INVENTORY')
    );
    const userId = (scope === 'all' && hasAccessToAll) ? undefined : req.user.id;
    return this.vmInventoryService.findAll(userId);
  }

  @Delete(':id')
  async delete(@Param('id') id: string) {
    return this.vmInventoryService.delete(id);
  }

  @Put(':id/config')
  async updateConfig(@Param('id') id: string, @Body() data: any) {
    return this.vmInventoryService.updateConfig(id, data);
  }

  @Post(':id/reveal')
  async revealSecret(
    @Param('id') id: string,
    @Body('password') password: string,
    @Req() req: any,
  ) {
    await this.authService.verifyPassword(req.user.id || req.user.sub, password);
    return this.vmInventoryService.revealSecret(id, req.user.id || req.user.sub);
  }
}

