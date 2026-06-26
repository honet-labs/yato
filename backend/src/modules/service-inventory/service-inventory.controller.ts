import { Controller, Get, Post, Param, UseGuards, Put, Body, Query, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ServiceInventoryService } from './service-inventory.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { Permissions } from '../auth/decorators/permissions.decorator';

@ApiTags('service-inventory')
@Controller('service-inventory')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@ApiBearerAuth()
export class ServiceInventoryController {
  constructor(private readonly serviceInventoryService: ServiceInventoryService) {}

  @Post()
  @Permissions('PROVISION_SERVICE')
  @ApiOperation({ summary: 'Create service inventory item directly' })
  create(@Body() data: any, @Req() req: any) {
    return this.serviceInventoryService.create(data, req.user.id);
  }

  @Get()
  @ApiOperation({ summary: 'Get service inventory items (personal or global)' })
  findAll(@Query('scope') scope: string, @Req() req: any) {
    const hasAccessToAll = req.user.roles?.some((r: any) => 
      r.role.name === 'ADMIN' || 
      r.role.permissions?.includes('MANAGE_SERVICE_INVENTORY')
    );
    const userId = (scope === 'all' && hasAccessToAll) ? undefined : req.user.id;
    return this.serviceInventoryService.findAll(userId);
  }

  @Get(':requestId')
  @ApiOperation({ summary: 'Get service inventory by request ID' })
  findByRequestId(@Param('requestId') requestId: string) {
    return this.serviceInventoryService.findByRequestId(requestId);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update service inventory item' })
  update(@Param('id') id: string, @Body() data: any) {
    return this.serviceInventoryService.update(id, data);
  }
}
