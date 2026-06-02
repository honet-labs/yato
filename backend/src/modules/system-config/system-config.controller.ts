import { Controller, Get, Put, Post, Body, UseGuards, Req, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { SystemConfigService } from './system-config.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { Permissions } from '../auth/decorators/permissions.decorator';

@ApiTags('system-config')
@Controller('system/config')
export class SystemConfigController {
  constructor(private readonly systemConfigService: SystemConfigService) {}

  @Get('branding')
  @ApiOperation({ summary: 'Get public branding configuration' })
  getBranding() {
    return this.systemConfigService.getBrandingConfig();
  }

  @Get()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('MANAGE_CONFIG')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all system settings' })
  findAll() {
    return this.systemConfigService.getAllSettings();
  }

  @Put()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('MANAGE_CONFIG')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update system settings' })
  update(@Body() settings: Record<string, any>, @Req() req: any) {
    const promises = Object.entries(settings).map(([key, value]) => 
      this.systemConfigService.updateSetting(key, value, req.user.id)
    );
    return Promise.all(promises);
  }

  @Post('db/test')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('MANAGE_CONFIG')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Test primary database connection' })
  testDbConnection(@Body() config: any) {
    return this.systemConfigService.testDatabaseConnection(config);
  }

  @Post('db/save')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('MANAGE_CONFIG')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Save primary database connection to .env' })
  saveDbConnection(@Body() config: any, @Req() req: any) {
    return this.systemConfigService.saveDatabaseConfig(config, req.user.id);
  }

  @Get('status')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get real-time system status' })
  getStatus() {
    return this.systemConfigService.getSystemStatus();
  }

  @Get('logs')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('MANAGE_CONFIG')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get system runtime logs from Winston file transports' })
  getLogs(
    @Query('file') file?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('level') level?: string,
  ) {
    const parsedLimit = limit ? parseInt(limit, 10) : 200;
    return this.systemConfigService.getSystemLogs(file, parsedLimit, search, level);
  }

  @Get('tuning')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('MANAGE_CONFIG')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current system performance tuning configurations' })
  getTuning() {
    return this.systemConfigService.getTuningConfig();
  }

  @Post('tuning')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('MANAGE_CONFIG')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Save performance tuning configurations and optionally trigger restart' })
  saveTuning(@Body() config: any, @Req() req: any) {
    return this.systemConfigService.saveTuningConfig(config, req.user.id);
  }

  @Post('restart')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('MANAGE_CONFIG')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Trigger manual system services graceful restart' })
  triggerManualRestart(@Req() req: any) {
    this.systemConfigService.triggerRestart();
    return { success: true, message: 'Restart triggered successfully. Server will be offline temporarily.' };
  }
}
