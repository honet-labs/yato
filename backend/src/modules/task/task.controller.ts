import { Controller, Get, Post, Patch, Delete, Body, UseGuards, Request, Param } from '@nestjs/common';
import { TaskService } from './task.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateTaskDto, UpdateTaskDto, CreateTaskCommentDto, UpdateTaskCommentDto, CreateTaskTemplateDto, UpdateTaskTemplateDto } from './dto/task.dto';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('tasks')
@ApiBearerAuth()
@Controller('tasks')
@UseGuards(JwtAuthGuard)
export class TaskController {
  constructor(private taskService: TaskService) {}

  @Get()
  @ApiOperation({ summary: 'Fetch all tasks' })
  async findAll(@Request() req: any) {
    return this.taskService.findAll(req.user);
  }

  @Get('templates')
  @ApiOperation({ summary: 'Fetch all task templates' })
  async findAllTemplates(@Request() req: any) {
    return this.taskService.findAllTemplates(req.user.id);
  }

  @Get('templates/:id')
  @ApiOperation({ summary: 'Fetch single task template' })
  async findOneTemplate(@Param('id') id: string, @Request() req: any) {
    return this.taskService.findOneTemplate(id, req.user.id);
  }

  @Post('templates')
  @ApiOperation({ summary: 'Create a new task template' })
  async createTemplate(@Body() dto: CreateTaskTemplateDto, @Request() req: any) {
    return this.taskService.createTemplate(dto, req.user.id);
  }

  @Patch('templates/:id')
  @ApiOperation({ summary: 'Update a task template' })
  async updateTemplate(@Param('id') id: string, @Body() dto: UpdateTaskTemplateDto, @Request() req: any) {
    return this.taskService.updateTemplate(id, dto, req.user.id);
  }

  @Delete('templates/:id')
  @ApiOperation({ summary: 'Delete a task template' })
  async deleteTemplate(@Param('id') id: string, @Request() req: any) {
    return this.taskService.deleteTemplate(id, req.user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Fetch single task detail' })
  async findOne(@Param('id') id: string, @Request() req: any) {
    return this.taskService.findOne(id, req.user);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new task' })
  async create(@Body() dto: CreateTaskDto, @Request() req: any) {
    return this.taskService.create(dto, req.user.id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update task properties' })
  async update(@Param('id') id: string, @Body() dto: UpdateTaskDto, @Request() req: any) {
    return this.taskService.update(id, dto, req.user);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete specific task' })
  async delete(@Param('id') id: string, @Request() req: any) {
    return this.taskService.delete(id, req.user);
  }

  @Post(':id/comments')
  @ApiOperation({ summary: 'Post comment to task' })
  async createComment(
    @Param('id') id: string,
    @Body() dto: CreateTaskCommentDto,
    @Request() req: any,
  ) {
    return this.taskService.createComment(id, dto, req.user);
  }

  @Patch('comments/:commentId')
  @ApiOperation({ summary: 'Update/edit a task comment' })
  async updateComment(
    @Param('commentId') commentId: string,
    @Body() dto: UpdateTaskCommentDto,
    @Request() req: any,
  ) {
    return this.taskService.updateComment(commentId, dto.content, req.user.id);
  }

  @Post(':id/attachments')
  @ApiOperation({ summary: 'Upload attachment to task' })
  async addAttachment(
    @Param('id') id: string,
    @Body() body: { base64Data: string; filename: string },
    @Request() req: any,
  ) {
    return this.taskService.addAttachment(id, body.base64Data, body.filename, req.user);
  }

  @Delete('attachments/:fileId')
  @ApiOperation({ summary: 'Delete task attachment' })
  async removeAttachment(@Param('fileId') fileId: string, @Request() req: any) {
    return this.taskService.removeAttachment(fileId, req.user);
  }
}
