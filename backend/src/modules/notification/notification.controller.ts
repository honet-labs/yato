import { Controller, Get, Post, Param, UseGuards, Req, Body, Query } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('notifications')
@Controller('notifications')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Get()
  @ApiOperation({ summary: 'Get current user notifications' })
  findAll(@Req() req: any, @Query('page') page?: string, @Query('limit') limit?: string) {
    return this.notificationService.findAll(req.user.id, parseInt(page) || 1, parseInt(limit) || 20);
  }

  @Post(':id/read')
  @ApiOperation({ summary: 'Mark notification as read' })
  markAsRead(@Param('id') id: string) {
    return this.notificationService.markAsRead(id);
  }

  @Post('read-all')
  @ApiOperation({ summary: 'Mark all notifications as read' })
  markAllAsRead(@Req() req: any) {
    return this.notificationService.markAllAsRead(req.user.id);
  }

  @Post('test-email')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Test email configuration' })
  testEmail(@Body() config: any) {
    return this.notificationService.sendEmail(config.recipient, 'YATO Test Email', 'This is a test email from YATO.', config);
  }

  @Post('test-wa')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Test WhatsApp configuration' })
  testWa(@Body() config: any) {
    return this.notificationService.sendWhatsApp(config.recipient, 'YATO Test WhatsApp Message', config);
  }

  @Post('test-telegram')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Test Telegram configuration' })
  testTelegram(@Body() config: any) {
    return this.notificationService.sendTelegram(config.chatId, '<b>YATO Test Telegram</b>\n\nThis is a test message from your infrastructure portal.', config);
  }

  @Post('broadcast')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Broadcast message to selected/all users' })
  broadcast(@Body() payload: any) {
    return this.notificationService.broadcast(payload);
  }
}
