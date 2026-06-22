import { Controller, Get, Post, Patch, Body, Param, UseGuards, Query, Request } from '@nestjs/common';
import { TicketCommentService } from './ticket-comment.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('ticket-comments')
@Controller('ticket-comments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
export class TicketCommentController {
  constructor(private readonly commentService: TicketCommentService) {}

  @Post()
  @ApiOperation({ summary: 'Add a new comment to a ticket' })
  async create(@Request() req, @Body() body: { content: string; attachment?: string; vmRequestId?: string; serviceRequestId?: string; supportTicketId?: string; parentId?: string }) {
    return this.commentService.create({
      ...body,
      authorId: req.user.id,
    });
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update/edit a ticket comment' })
  async update(@Param('id') id: string, @Request() req, @Body() body: { content: string; attachment?: string }) {
    return this.commentService.update(id, body, req.user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get all comments for a specific ticket' })
  async findByTicket(@Param('id') id: string, @Query('type') type: 'VM' | 'SERVICE' | 'SUPPORT') {
    return this.commentService.findByTicket(id, type);
  }
}

