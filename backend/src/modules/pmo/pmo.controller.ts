import { Controller, Get, Post, Patch, Delete, Body, UseGuards, Request, Param } from '@nestjs/common';
import { PmoService } from './pmo.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('pmo')
@ApiBearerAuth()
@Controller('pmo')
@UseGuards(JwtAuthGuard)
export class PmoController {
  constructor(private readonly pmoService: PmoService) {}

  // ==========================================
  // PROJECTS
  // ==========================================

  @Get('projects')
  @ApiOperation({ summary: 'Retrieve all projects' })
  async findAllProjects(@Request() req: any) {
    return this.pmoService.findAllProjects(req.user);
  }

  @Post('projects')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Create a new project' })
  async createProject(
    @Body() body: {
      name: string;
      description?: string;
      startDate: string;
      endDate: string;
      status?: string;
      colorCode?: string;
    },
  ) {
    return this.pmoService.createProject(body);
  }

  @Patch('projects/:id')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Update a project' })
  async updateProject(
    @Param('id') id: string,
    @Body() body: {
      name?: string;
      description?: string;
      startDate?: string;
      endDate?: string;
      status?: string;
      colorCode?: string;
    },
  ) {
    return this.pmoService.updateProject(id, body);
  }

  @Delete('projects/:id')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Delete a project' })
  async deleteProject(@Param('id') id: string) {
    return this.pmoService.deleteProject(id);
  }

  // ==========================================
  // MILESTONES
  // ==========================================

  @Get('milestones')
  @ApiOperation({ summary: 'Retrieve all milestones' })
  async findAllMilestones() {
    return this.pmoService.findAllMilestones();
  }

  @Post('milestones')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Create a new milestone' })
  async createMilestone(
    @Body() body: {
      projectId: string;
      title: string;
      description?: string;
      dueDate: string;
      isReached?: boolean;
    },
  ) {
    return this.pmoService.createMilestone(body);
  }

  @Patch('milestones/:id')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Update a milestone' })
  async updateMilestone(
    @Param('id') id: string,
    @Body() body: {
      title?: string;
      description?: string;
      dueDate?: string;
      isReached?: boolean;
    },
  ) {
    return this.pmoService.updateMilestone(id, body);
  }

  @Delete('milestones/:id')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Delete a milestone' })
  async deleteMilestone(@Param('id') id: string) {
    return this.pmoService.deleteMilestone(id);
  }

  // ==========================================
  // CALENDAR NOTES
  // ==========================================

  @Get('calendar-notes')
  @ApiOperation({ summary: 'Retrieve all calendar notes for the current user' })
  async findAllCalendarNotes(@Request() req: any) {
    return this.pmoService.findAllCalendarNotes(req.user.id);
  }

  @Post('calendar-notes')
  @ApiOperation({ summary: 'Create a new calendar note' })
  async createCalendarNote(
    @Request() req: any,
    @Body() body: {
      targetDate: string;
      title: string;
      content?: string;
      category?: string;
    },
  ) {
    return this.pmoService.createCalendarNote(req.user.id, body);
  }

  @Patch('calendar-notes/:id')
  @ApiOperation({ summary: 'Update a calendar note' })
  async updateCalendarNote(
    @Param('id') id: string,
    @Request() req: any,
    @Body() body: {
      title?: string;
      content?: string;
      category?: string;
      targetDate?: string;
    },
  ) {
    return this.pmoService.updateCalendarNote(id, req.user.id, body);
  }

  @Delete('calendar-notes/:id')
  @ApiOperation({ summary: 'Delete a calendar note' })
  async deleteCalendarNote(@Param('id') id: string, @Request() req: any) {
    return this.pmoService.deleteCalendarNote(id, req.user.id);
  }
}
