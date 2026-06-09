import { Controller, Get, Post, Patch, Delete, Body, UseGuards, Request, Param, Query } from '@nestjs/common';
import { NoteService } from './note.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('notes')
@ApiBearerAuth()
@Controller('notes')
@UseGuards(JwtAuthGuard)
export class NoteController {
  constructor(private readonly noteService: NoteService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new note' })
  async create(
    @Request() req: any,
    @Body() body: {
      title?: string;
      content: string;
      color?: string;
      isPinned?: boolean;
      isArchived?: boolean;
      isTrashed?: boolean;
      reminderAt?: string;
      repeatInterval?: string;
    },
  ) {
    return this.noteService.create(req.user.id, body);
  }

  @Get()
  @ApiOperation({ summary: 'Get all notes with optional filters' })
  async findAll(
    @Request() req: any,
    @Query('isPinned') isPinned?: string,
    @Query('isArchived') isArchived?: string,
    @Query('isTrashed') isTrashed?: string,
    @Query('hasReminder') hasReminder?: string,
  ) {
    return this.noteService.findAll(req.user.id, {
      isPinned: isPinned === 'true' ? true : isPinned === 'false' ? false : undefined,
      isArchived: isArchived === 'true' ? true : isArchived === 'false' ? false : undefined,
      isTrashed: isTrashed === 'true' ? true : isTrashed === 'false' ? false : undefined,
      hasReminder: hasReminder === 'true' ? true : undefined,
    });
  }

  @Post('empty-trash')
  @ApiOperation({ summary: 'Empty all trashed notes' })
  async emptyTrash(@Request() req: any) {
    return this.noteService.emptyTrash(req.user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get single note' })
  async findOne(@Param('id') id: string, @Request() req: any) {
    return this.noteService.findOne(id, req.user.id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update note properties' })
  async update(
    @Param('id') id: string,
    @Request() req: any,
    @Body() body: {
      title?: string;
      content?: string;
      color?: string;
      isPinned?: boolean;
      isArchived?: boolean;
      isTrashed?: boolean;
      reminderAt?: string | null;
      repeatInterval?: string | null;
    },
  ) {
    return this.noteService.update(id, req.user.id, body);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Permanently delete a note' })
  async remove(@Param('id') id: string, @Request() req: any) {
    return this.noteService.remove(id, req.user.id);
  }
}
