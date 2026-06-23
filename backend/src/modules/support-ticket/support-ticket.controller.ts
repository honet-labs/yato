import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { SupportTicketService } from './support-ticket.service';
import { CreateSupportTicketDto } from './dto/support-ticket.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@ApiTags('support-tickets')
@Controller('support-tickets')
export class SupportTicketController {
  constructor(private readonly supportTicketService: SupportTicketService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new support ticket' })
  create(@Body() dto: CreateSupportTicketDto, @Req() req: any) {
    return this.supportTicketService.create(dto, req.user.id);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all support tickets' })
  findAll(@Req() req: any) {
    return this.supportTicketService.findAll(req.user);
  }

  @Get('tags')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all unique tags used in support tickets' })
  async getUniqueTags() {
    return this.supportTicketService.getUniqueTags();
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get a support ticket by ID' })
  findOne(@Param('id') id: string, @Req() req: any) {
    return this.supportTicketService.findOne(id, req.user);
  }

  @Put(':id/status')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update support ticket status' })
  updateStatus(@Param('id') id: string, @Body('status') status: string, @Req() req: any) {
    return this.supportTicketService.updateStatus(id, status, req.user);
  }

  @Post(':id/followers')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Add a follower to a support ticket' })
  async addFollower(@Param('id') id: string, @Body('userId') userId: string, @Req() req: any) {
    return this.supportTicketService.addFollower(id, userId, req.user);
  }

  @Delete(':id/followers/:userId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Remove a follower from a support ticket' })
  async removeFollower(@Param('id') id: string, @Param('userId') userId: string, @Req() req: any) {
    return this.supportTicketService.removeFollower(id, userId, req.user);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a support ticket' })
  update(@Param('id') id: string, @Body() dto: any, @Req() req: any) {
    return this.supportTicketService.update(id, dto, req.user);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a support ticket (Admin only)' })
  async deleteTicket(@Param('id') id: string, @Req() req: any) {
    return this.supportTicketService.deleteTicket(id, req.user.id);
  }
}
